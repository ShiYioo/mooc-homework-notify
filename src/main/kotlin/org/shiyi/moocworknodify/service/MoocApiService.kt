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
    private val cookieExpirationService: CookieExpirationService
) {
    private val logger = LoggerFactory.getLogger(javaClass)

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    /**
     * 获取指定学期的课程详细信息
     *
     * @param termId 学期ID
     * @return MOOC响应数据，如果请求失败则返回null
     */
    fun getCourseInfo(termId: String): MoocResponse? {
        try {
            val url = "${moocProperties.apiBaseUrl}?csrfKey=${moocProperties.csrfKey}"

            val requestBody = FormBody.Builder()
                .add("termId", termId)
                .build()

            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .addHeader("Cookie", moocProperties.cookie)
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

                val moocResponse = objectMapper.readValue(responseBody, MoocResponse::class.java)

                if (moocResponse.code != 0) {
                    logger.error("MOOC API返回错误码: code={}, termId={}", moocResponse.code, termId)
                    return null
                }

                // 检测Cookie是否过期：code=0但result=null表示Cookie认证失败
                if (moocResponse.result == null) {
                    logger.error("检测到Cookie已过期: code={}, result=null, termId={}", moocResponse.code, termId)

                    // 只发送一次通知
                    if (cookieExpirationService.shouldSendNotification()) {
                        logger.warn("Cookie已过期，正在发送通知给管理员...")
                        emailNotificationService.sendCookieExpirationNotification(moocProperties.adminEmail)
                    } else {
                        logger.info("Cookie过期通知已发送过，本次不再发送")
                    }

                    return null
                }

                logger.info("成功获取课程信息: termId={}, courseName={}",
                    termId,
                    moocResponse.result.mocTermDto?.courseName
                )

                return moocResponse
            }
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

