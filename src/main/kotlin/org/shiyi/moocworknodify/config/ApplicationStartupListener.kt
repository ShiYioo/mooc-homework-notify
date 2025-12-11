package org.shiyi.moocworknodify.config

import mu.KotlinLogging
import org.shiyi.moocworknodify.service.MoocBrowserLoginService
import org.springframework.boot.SpringApplication
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.ApplicationContext
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import kotlin.system.exitProcess

/**
 * 应用启动监听器
 *
 * 在应用启动完成后执行自动登录等初始化任务
 *
 * @author ShiYi
 */
@Component
class ApplicationStartupListener(
    private val moocProperties: MoocProperties,
    private val browserLoginService: MoocBrowserLoginService,
    private val applicationContext: ApplicationContext
) {

    private val logger = KotlinLogging.logger {}

    /**
     * 应用启动完成后执行
     * 使用 ApplicationReadyEvent 确保所有 Bean 都已初始化完成
     */
    @EventListener(ApplicationReadyEvent::class)
    fun onApplicationReady() {
        logger.info { "=" .repeat(60) }
        logger.info { "应用启动完成，开始初始化..." }
        logger.info { "=" .repeat(60) }

        // 等待Playwright初始化完成
        try {
            logger.info { "等待Playwright浏览器初始化完成..." }
            PlaywrightInitializer.waitForInitialization(120000)
            logger.info { "✅ Playwright浏览器已就绪" }
        } catch (e: Exception) {
            logger.error(e) { "❌ Playwright初始化失败，程序即将退出" }
            shutdownApplication("Playwright初始化失败")
            return
        }

        // 如果启用了自动登录，立即执行登录
        if (moocProperties.login.enabled) {
            performAutoLogin()
        } else {
            logger.warn { "自动登录未启用，将使用配置文件中的Cookie" }
            logger.warn { "如果Cookie过期，作业提醒功能将无法正常工作" }
            logger.warn { "建议启用自动登录功能：mooc.login.enabled=true" }
        }

        logger.info { "=" .repeat(60) }
        logger.info { "初始化完成，开始监控作业截止时间..." }
        logger.info { "=" .repeat(60) }
    }

    /**
     * 执行自动登录
     */
    private fun performAutoLogin() {
        logger.info { "🔐 检测到启用了自动登录功能" }

        // 先检查是否有缓存的Cookie
        val cachedCookie = browserLoginService.loadCachedCookie()

        if (cachedCookie != null && browserLoginService.isCookieValid(cachedCookie)) {
            logger.info { "✅ 发现有效的Cookie缓存，跳过登录" }
            logger.info { "Cookie缓存文件: ${moocProperties.login.cookieCacheFile}" }
            logger.info { "CSRF密钥: ${cachedCookie.csrfKey.take(16)}..." }
            logger.info { "提示: 如需重新登录，请删除缓存文件" }
            return
        }

        // 没有缓存或缓存无效，执行登录
        logger.info { "🚀 开始自动登录MOOC平台..." }
        logger.info { "登录邮箱: ${moocProperties.login.email}" }
        logger.info { "无头模式: ${moocProperties.login.browser.headless}" }

        try {
            val (cookie, csrfKey) = browserLoginService.loginAndGetCookie()

            logger.info { "=" .repeat(60) }
            logger.info { "🎉 自动登录成功！" }
            logger.info { "Cookie长度: ${cookie.length}" }
            logger.info { "CSRF密钥: ${csrfKey.take(16)}..." }
            logger.info { "Cookie已缓存到: ${moocProperties.login.cookieCacheFile}" }
            logger.info { "=" .repeat(60) }

        } catch (e: Exception) {
            logger.error(e) { "❌ 自动登录失败" }
            logger.error { "错误原因: ${e.message}" }
            logger.error { "=" .repeat(60) }

            // 登录失败，停止应用
            shutdownApplication("自动登录失败: ${e.message}")
        }
    }

    /**
     * 优雅关闭应用
     */
    private fun shutdownApplication(reason: String) {
        logger.error { "=" .repeat(60) }
        logger.error { "❌ 应用启动失败: $reason" }
        logger.error { "程序即将退出..." }
        logger.error { "=" .repeat(60) }

        // 使用SpringApplication优雅关闭
        SpringApplication.exit(applicationContext, { 1 })
        exitProcess(1)
    }
}

