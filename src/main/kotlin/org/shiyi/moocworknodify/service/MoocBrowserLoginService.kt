package org.shiyi.moocworknodify.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.microsoft.playwright.*
import com.microsoft.playwright.options.LoadState
import mu.KotlinLogging
import org.shiyi.moocworknodify.config.MoocProperties
import org.springframework.stereotype.Service
import java.io.File
import java.time.Instant

/**
 * MOOC无头浏览器登录服务
 *
 * 使用Playwright自动化浏览器进行登录，绕过复杂的加密和反爬机制
 *
 * @author ShiYi
 */
@Service
class MoocBrowserLoginService(
    private val moocProperties: MoocProperties,
    private val objectMapper: ObjectMapper
) {

    private val logger = KotlinLogging.logger {}

    /**
     * Cookie缓存数据类
     */
    data class CookieCache(
        val cookie: String,
        val csrfKey: String,
        val timestamp: Long
    )

    /**
     * 使用无头浏览器登录MOOC并获取Cookie
     *
     * @return Pair<Cookie字符串, CSRF密钥>
     */
    fun loginAndGetCookie(): Pair<String, String> {
        val email = moocProperties.login.email
        val password = moocProperties.login.password

        require(email.isNotBlank()) { "登录邮箱不能为空，请在配置文件中设置 mooc.login.email" }
        require(password.isNotBlank()) { "登录密码不能为空，请在配置文件中设置 mooc.login.password" }

        logger.info { "开始使用无头浏览器登录MOOC，邮箱: $email" }

        val playwright = Playwright.create()

        try {

            val launchOptions = BrowserType.LaunchOptions()
                .setTimeout(60000.0)  // 增加启动超时到60秒

            val browser = playwright.chromium().launch(launchOptions)

            // 创建浏览器上下文
            val context = browser.newContext(
                Browser.NewContextOptions()
                    .setViewportSize(1920, 1080)
                    .setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .setLocale("zh-CN")
                    .setTimezoneId("Asia/Shanghai")
            )

            // 注入反检测脚本
            context.addInitScript("""
                // 移除webdriver标识
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
                
                // 模拟真实的plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5]
                });
                
                // 模拟真实的languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['zh-CN', 'zh', 'en']
                });
                
                // 隐藏chrome标识
                Object.defineProperty(navigator, 'chrome', {
                    get: () => true
                });
            """)

            val page = context.newPage()

            // 设置页面超时
            page.setDefaultTimeout(moocProperties.login.browser.timeout.toDouble())

            // 访问登录页面
            logger.info { "访问登录页面: ${moocProperties.login.browser.loginUrl}" }
            page.navigate(moocProperties.login.browser.loginUrl)

            // 等待页面加载完成
            page.waitForLoadState(LoadState.NETWORKIDLE)
            Thread.sleep(3000)  // 额外等待，确保JavaScript和iframe完全执行

            logger.info { "当前页面URL: ${page.url()}" }

            // 首先尝试切换到邮箱登录标签（在iframe外部）
            try {
                // 查找邮箱登录标签 - 使用多种选择器
                val emailTabSelectors = listOf(
                    "li:has-text('邮箱登录')",
                    ".last-login-holder:has-text('邮箱')",
                    "li.last-login-holder:nth-child(2)",  // 第二个标签通常是邮箱登录
                    "text=邮箱登录"
                )

                var tabClicked = false
                for (selector in emailTabSelectors) {
                    try {
                        val emailTab = page.locator(selector).first()
                        if (emailTab.isVisible) {
                            logger.info { "找到邮箱登录标签: $selector" }
                            // 检查是否已经选中
                            val className = emailTab.getAttribute("class") ?: ""
                            if (!className.contains("z-sel")) {
                                logger.info { "切换到邮箱登录标签" }
                                emailTab.click()
                                Thread.sleep(1000)  // 等待iframe重新加载
                            } else {
                                logger.info { "邮箱登录标签已选中" }
                            }
                            tabClicked = true
                            break
                        }
                    } catch (e: Exception) {
                        logger.debug { "尝试标签选择器失败: $selector, ${e.message}" }
                    }
                }

                if (!tabClicked) {
                    logger.warn { "未找到邮箱登录标签，可能默认就是邮箱登录" }
                }
            } catch (e: Exception) {
                logger.warn { "切换邮箱登录标签失败: ${e.message}" }
            }

            // 查找并进入登录iframe
            logger.info { "查找登录iframe" }
            val loginFrame = findLoginFrame(page)

            // 填写邮箱
            logger.info { "填写邮箱: $email" }
            val emailInput = findEmailInput(loginFrame)
            emailInput.clear()
            emailInput.fill(email, Locator.FillOptions().setTimeout(5000.0))

            // 模拟人类输入行为
            Thread.sleep((300..600).random().toLong())

            // 填写密码
            logger.info { "填写密码" }
            val passwordInput = findPasswordInput(loginFrame)
            passwordInput.clear()
            passwordInput.fill(password, Locator.FillOptions().setTimeout(5000.0))

            Thread.sleep((300..600).random().toLong())

            // 点击登录按钮
            logger.info { "点击登录按钮" }
            val loginButton = findLoginButton(loginFrame)
            loginButton.click()

            // 等待登录结果
            try {
                // 方式1: 等待URL变化（跳转到首页或课程页）
                page.waitForURL("**/*course*/**", Page.WaitForURLOptions().setTimeout(15000.0))
                logger.info { "检测到页面跳转，登录成功！" }
            } catch (e: TimeoutError) {
                // 方式2: 检查是否仍在登录页面
                val currentUrl = page.url()
                if (currentUrl.contains("login")) {
                    // 查找错误提示
                    val errorMsg = findErrorMessage(page)
                    throw RuntimeException("登录失败: $errorMsg")
                }
                logger.info { "登录成功，当前URL: $currentUrl" }
            }

            // 等待Cookie设置完成
            Thread.sleep(2000)

            // 获取所有Cookie
            val cookies = context.cookies()

            // 提取CSRF密钥
            val csrfKey = cookies.find { it.name == "NTESSTUDYSI" }?.value
                ?: throw RuntimeException("未找到CSRF密钥（NTESSTUDYSI Cookie）")

            // 构建Cookie字符串
            val cookieString = cookies.joinToString("; ") { "${it.name}=${it.value}" }

            logger.info { "✅ 登录成功！Cookie长度: ${cookieString.length}, CSRF密钥: ${csrfKey.take(16)}..." }

            // 保存Cookie到缓存
            saveCookieCache(cookieString, csrfKey)

            // 关闭浏览器
            browser.close()
            playwright.close()

            return Pair(cookieString, csrfKey)

        } catch (e: Exception) {
            logger.error(e) { "❌ 自动登录失败" }
            playwright.close()
            throw RuntimeException("MOOC自动登录失败: ${e.message}", e)
        }
    }

    /**
     * 查找登录iframe
     */
    private fun findLoginFrame(page: Page): FrameLocator {
        logger.info { "等待登录iframe加载" }

        // 先等待页面中出现iframe元素
        try {
            page.waitForSelector("iframe[id*='URS-iframe']", Page.WaitForSelectorOptions().setTimeout(8000.0))
            logger.info { "✅ 检测到URS iframe元素" }
        } catch (e: Exception) {
            logger.warn { "未检测到URS iframe，尝试等待任何iframe: ${e.message}" }
            try {
                page.waitForSelector("iframe", Page.WaitForSelectorOptions().setTimeout(5000.0))
                logger.info { "检测到iframe元素" }
            } catch (e2: Exception) {
                logger.error { "未检测到任何iframe元素: ${e2.message}" }
            }
        }

        // 额外等待iframe内容加载
        Thread.sleep(2000)

        // 获取并打印所有iframe信息用于调试
        try {
            val iframeCount = page.locator("iframe").count()
            logger.info { "页面共有 $iframeCount 个iframe" }

            for (i in 0 until iframeCount) {
                try {
                    val iframeElement = page.locator("iframe").nth(i)
                    val id = iframeElement.getAttribute("id") ?: "无ID"
                    val src = iframeElement.getAttribute("src") ?: "无src"
                    logger.info { "  iframe[$i]: id=$id, src=${src.take(80)}..." }
                } catch (ignored: Exception) {
                }
            }
        } catch (e: Exception) {
            logger.warn { "获取iframe列表失败: ${e.message}" }
        }

        // 尝试多个可能的iframe选择器 - 按优先级排序
        val frameSelectors = listOf(
            // 基于实际HTML结构的精确选择器
            "#j-ursContainer-1 iframe",  // 邮箱登录的container (ID from HTML)
            "iframe[id*='URS-iframe'][src*='index_dl2_new']",
            ".ux-login-set-container iframe",
            // 通用选择器
            "iframe[id*='URS-iframe']",
            "iframe[src*='reg.icourse163.org']",
            "iframe[src*='index_dl2']",
            "iframe[src*='index_dl']"
        )

        // 首先尝试精确匹配
        for (selector in frameSelectors) {
            try {
                logger.debug { "尝试iframe选择器: $selector" }
                val frames = page.frameLocator(selector)

                // 尝试在frame中查找登录相关元素来验证这是登录frame
                val testSelectors = listOf(
                    "input.dlemail",
                    "input[name='email']",
                    "input[type='tel']",
                    "input[type='password']"
                )

                for (testSelector in testSelectors) {
                    try {
                        val testLocator = frames.locator(testSelector).first()
                        testLocator.waitFor(Locator.WaitForOptions().setTimeout(2000.0))
                        if (testLocator.isVisible) {
                            logger.info { "✅ 找到登录iframe: $selector (验证: $testSelector)" }
                            return frames
                        }
                    } catch (ignored: Exception) {
                        // 继续尝试下一个验证选择器
                    }
                }
            } catch (e: Exception) {
                logger.debug { "选择器失败: $selector" }
            }
        }

        // 如果所有iframe选择器都失败，遍历所有iframe逐个测试
        logger.info { "遍历所有iframe进行测试..." }
        try {
            val iframeCount = page.locator("iframe").count()

            for (i in 0 until iframeCount) {
                try {
                    val frame = page.frameLocator("iframe").nth(i)
                    val testLocator = frame.locator("input[type='tel'], input[type='password'], input.dlemail, input[name='email']").first()
                    testLocator.waitFor(Locator.WaitForOptions().setTimeout(1000.0))
                    logger.info { "✅ 找到登录iframe: 第 ${i + 1} 个iframe" }
                    return frame
                } catch (ignored: Exception) {
                    // 继续尝试下一个iframe
                }
            }
        } catch (e: Exception) {
            logger.error { "遍历iframe失败: ${e.message}" }
        }

        throw RuntimeException("未找到登录iframe。请检查: 1)登录URL是否正确 2)网络是否正常 3)查看截图: /tmp/mooc-login-debug-*.png")
    }

    /**
     * 查找邮箱输入框（多种选择器）
     */
    private fun findEmailInput(frame: FrameLocator): Locator {
        val selectors = listOf(
            "input.dlemail.j-nameforslide",  // MOOC当前使用的class
            "input[name='email']",
            "input[id='phoneipt']",
            "input[placeholder*='手机']",
            "input[placeholder*='邮箱']",
            "input[type='email']",
            "input[type='tel']",
            "input[id*='email']",
            ".email-input input"
        )

        for (selector in selectors) {
            try {
                val locator = frame.locator(selector).first()
                locator.waitFor(Locator.WaitForOptions().setTimeout(2000.0))
                if (locator.isVisible) {
                    logger.debug { "找到邮箱输入框: $selector" }
                    return locator
                }
            } catch (e: Exception) {
                // 继续尝试下一个选择器
            }
        }

        throw RuntimeException("未找到邮箱输入框，页面可能已改版")
    }

    /**
     * 查找密码输入框
     */
    private fun findPasswordInput(frame: FrameLocator): Locator {
        val selectors = listOf(
            // 基于实际HTML结构的精确选择器
            "input.dlpwd",                                          // MOOC实际使用的class
            "input.j-inputtext.dlpwd",                            // 完整class
            "input[name='password'][class*='dlpwd']",            // 组合选择器
            // 通用选择器（备用）
            "input[type='password']:not([style*='display: none']):not([style*='display:none'])",
            "input[type='password'].j-inputtext",
            "input[placeholder*='密码']",
            "input[name='password']",
            ".password-input input"
        )

        for (selector in selectors) {
            try {
                val locator = frame.locator(selector).first()
                locator.waitFor(Locator.WaitForOptions().setTimeout(2000.0))
                if (locator.isVisible) {
                    logger.debug { "找到密码输入框: $selector" }
                    return locator
                }
            } catch (e: Exception) {
                logger.debug { "选择器失败: $selector, ${e.message}" }
                // 继续尝试下一个选择器
            }
        }

        throw RuntimeException("未找到密码输入框，页面可能已改版")
    }

    /**
     * 查找登录按钮
     */
    private fun findLoginButton(frame: FrameLocator): Locator {
        val selectors = listOf(
            // 基于实际HTML结构的精确选择器
            "a#dologin",                          // ID选择器（最精确）
            "a.u-loginbtn",                       // class选择器
            "a[data-action='dologin']",          // 通过data属性
            ".loginbox a",                        // 通过父容器
            ".j-power-btn a",                     // 通过父容器class
            // 通用选择器（备用）
            "a:has-text('登录')",
            "a:has-text('登 录')",
            "button:has-text('登录')",
            "button:has-text('登 录')",
            ".login-btn",
            "button[type='submit']",
            "button.j-loginbtn"
        )

        for (selector in selectors) {
            try {
                val locator = frame.locator(selector).first()
                locator.waitFor(Locator.WaitForOptions().setTimeout(2000.0))
                if (locator.isVisible) {
                    logger.debug { "找到登录按钮: $selector" }
                    return locator
                }
            } catch (e: Exception) {
                logger.debug { "选择器失败: $selector, ${e.message}" }
                // 继续尝试下一个选择器
            }
        }

        throw RuntimeException("未找到登录按钮，页面可能已改版")
    }

    /**
     * 查找错误提示信息
     */
    private fun findErrorMessage(page: Page): String {
        val selectors = listOf(
            ".error-msg",
            ".error",
            "[class*='error']",
            ".tip",
            ".warning"
        )

        for (selector in selectors) {
            try {
                val locator = page.locator(selector).first()
                if (locator.isVisible) {
                    val text = locator.textContent()
                    if (!text.isNullOrBlank()) {
                        return text.trim()
                    }
                }
            } catch (e: Exception) {
                // 继续尝试下一个选择器
            }
        }

        return "未知错误，请检查邮箱和密码是否正确"
    }

    /**
     * 保存Cookie到缓存文件
     */
    private fun saveCookieCache(cookie: String, csrfKey: String) {
        try {
            val cacheFile = File(moocProperties.login.cookieCacheFile)
            cacheFile.parentFile?.mkdirs()

            val cache = CookieCache(
                cookie = cookie,
                csrfKey = csrfKey,
                timestamp = System.currentTimeMillis()
            )

            objectMapper.writerWithDefaultPrettyPrinter()
                .writeValue(cacheFile, cache)

            logger.info { "Cookie已保存到缓存文件: ${cacheFile.absolutePath}" }
        } catch (e: Exception) {
            logger.error(e) { "保存Cookie缓存失败" }
        }
    }

    /**
     * 从缓存文件加载Cookie
     */
    fun loadCachedCookie(): CookieCache? {
        return try {
            val cacheFile = File(moocProperties.login.cookieCacheFile)
            if (!cacheFile.exists()) {
                logger.debug { "Cookie缓存文件不存在: ${cacheFile.absolutePath}" }
                return null
            }

            val cache = objectMapper.readValue(cacheFile, CookieCache::class.java)
            logger.debug { "成功加载Cookie缓存，时间戳: ${Instant.ofEpochMilli(cache.timestamp)}" }
            cache
        } catch (e: Exception) {
            logger.error(e) { "加载Cookie缓存失败" }
            null
        }
    }

    /**
     * 检查Cookie缓存是否可用
     * 注意：这里只检查缓存是否存在和格式是否正确
     * 真正的有效性由MOOC API响应来判断（返回空则重新登录）
     */
    fun isCookieValid(cache: CookieCache): Boolean {
        // 只要缓存存在且有内容就认为可以尝试使用
        return cache.cookie.isNotEmpty() && cache.csrfKey.isNotEmpty()
    }

    /**
     * 清除Cookie缓存
     */
    fun clearCookieCache() {
        try {
            val cacheFile = File(moocProperties.login.cookieCacheFile)
            if (cacheFile.exists()) {
                cacheFile.delete()
                logger.info { "Cookie缓存已清除" }
            }
        } catch (e: Exception) {
            logger.error(e) { "清除Cookie缓存失败" }
        }
    }
}

