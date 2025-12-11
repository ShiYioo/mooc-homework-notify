package org.shiyi.moocworknodify.service

import com.fasterxml.jackson.databind.ObjectMapper
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import org.shiyi.moocworknodify.config.MoocProperties
import org.shiyi.moocworknodify.model.MoocResponse
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.util.concurrent.TimeUnit

/**
 * MOOC API服务
 * 负责与MOOC平台API交互，获取课程和作业信息
 *
 * @author ShiYi
 */
@Service
class MoocApiService(
    private val moocProperties: MoocProperties,
    private val objectMapper: ObjectMapper,
    private val emailNotificationService: EmailNotificationService,
    private val cookieExpirationService: CookieExpirationService,
    private val browserLoginService: MoocBrowserLoginService
) {
    private val logger = LoggerFactory.getLogger(javaClass)

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()


    /**
     * 获取Cookie和CSRF密钥
     * 优先使用：缓存的Cookie > 配置文件的Cookie > 自动登录
     */
    private fun getCookieAndCsrfKey(): Pair<String, String> {
        // 如果启用了自动登录，先尝试从缓存加载
        if (moocProperties.login.enabled) {
            val cachedCookie = browserLoginService.loadCachedCookie()
            if (cachedCookie != null && browserLoginService.isCookieValid(cachedCookie)) {
                logger.debug("使用缓存的Cookie")
                return Pair(cachedCookie.cookie, cachedCookie.csrfKey)
            }
        }

        // 使用配置文件中的Cookie（可能为空）
        if (moocProperties.cookie.isNotEmpty() && moocProperties.csrfKey.isNotEmpty()) {
            logger.debug("使用配置文件中的Cookie")
            return Pair(moocProperties.cookie, moocProperties.csrfKey)
        }

        // 如果启用了自动登录且没有可用Cookie，抛出异常由上层处理
        if (moocProperties.login.enabled) {
            throw IllegalStateException("没有可用的Cookie，需要自动登录")
        }

        throw IllegalStateException("没有配置Cookie，请在配置文件中设置或启用自动登录")
    }

    /**
     * 自动登录获取新Cookie
     */
    private fun loginAndRefreshCookie(): Pair<String, String>? {
        if (!moocProperties.login.enabled) {
            logger.warn("未启用自动登录，无法刷新Cookie，请手动配置 mooc.cookie 和 mooc.csrf-key")
            return null
        }

        logger.info("检测到Cookie过期，尝试自动重新登录...")
        return try {
            val (cookie, csrfKey) = browserLoginService.loginAndGetCookie()
            logger.info("✅ Cookie自动刷新成功")
            Pair(cookie, csrfKey)
        } catch (e: Exception) {
            logger.error("❌ Cookie自动刷新失败，请检查邮箱密码配置或网络连接", e)
            null
        }
    }

    /**
     * 执行API请求
     */
    private fun executeRequest(termId: String, cookie: String, csrfKey: String): MoocResponse? {
        val url = "${moocProperties.apiBaseUrl}?csrfKey=$csrfKey"

        val requestBody = FormBody.Builder()
            .add("termId", termId)
            .build()

        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .addHeader("Cookie", cookie)
            .addHeader("Content-Type", "application/x-www-form-urlencoded")
            .build()

        logger.debug("正在请求MOOC API: termId={}", termId)

        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                logger.error("MOOC API请求失败: HTTP {}, termId={}", response.code, termId)
                return null
            }

            val responseBody = response.body?.string()
            if (responseBody.isNullOrEmpty()) {
                logger.error("MOOC API返回空响应: termId={}", termId)
                return null
            }

            // 打印响应前500字符用于调试
            logger.info("MOOC API响应(前500字符): {}", responseBody.take(500))

            val moocResponse = objectMapper.readValue(responseBody, MoocResponse::class.java)

            if (moocResponse.code != 0) {
                logger.error("MOOC API返回错误码: code={}, termId={}", moocResponse.code, termId)
                return null
            }

            // 检测Cookie是否过期：code=0但result=null表示Cookie认证失败
            if (moocResponse.result == null) {
                logger.warn("检测到Cookie已过期: code={}, result=null, termId={}", moocResponse.code, termId)
                return null  // 返回null表示Cookie过期
            }

            logger.info("成功获取课程信息: termId={}, courseName={}",
                termId,
                moocResponse.result.mocTermDto?.courseName
            )

            return moocResponse
        }
    }

    /**
     * 获取指定学期的课程详细信息
     *
     * 逻辑：
     * 1. 先尝试使用现有Cookie请求
     * 2. 如果返回null（Cookie过期），则自动登录获取新Cookie
     * 3. 使用新Cookie重试一次
     *
     * @param termId 学期ID
     * @return MOOC响应数据，如果请求失败则返回null
     */
    fun getCourseInfo(termId: String): MoocResponse? {
        try {
            // 第一次尝试：使用现有Cookie
            val (cookie, csrfKey) = try {
                getCookieAndCsrfKey()
            } catch (e: IllegalStateException) {
                logger.warn("没有可用的Cookie: ${e.message}")
                // 如果启用了自动登录，立即登录
                if (moocProperties.login.enabled) {
                    loginAndRefreshCookie() ?: return null
                } else {
                    return null
                }
            }

            val result = executeRequest(termId, cookie, csrfKey)

            // 如果成功获取到数据，直接返回
            if (result != null) {
                return result
            }

            // 如果result为null，可能是Cookie过期，尝试自动登录重试
            logger.info("第一次请求失败，尝试自动登录后重试...")
            val newCredentials = loginAndRefreshCookie() ?: return null

            // 第二次尝试：使用新Cookie
            logger.info("使用新Cookie重试请求...")
            return executeRequest(termId, newCredentials.first, newCredentials.second)

        } catch (e: Exception) {
            logger.error("获取MOOC课程信息失败: termId={}", termId, e)
            return null
        }
    }

    /**
     * 批量获取多个学期的课程信息
     *
     * @param termIds 学期ID列表
     * @return 成功获取的MOOC响应数据列表
     */
    fun getBatchCourseInfo(termIds: List<String>): List<MoocResponse> {
        return termIds.mapNotNull { termId ->
            getCourseInfo(termId)
        }
    }
}

