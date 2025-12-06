package org.shiyi.moocworknodify.service

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Cookie过期通知服务
 * 确保Cookie过期通知只发送一次
 *
 * @author ShiYi
 */
@Service
class CookieExpirationService {
    private val logger = LoggerFactory.getLogger(javaClass)

    /**
     * 标记是否已经发送过Cookie过期通知
     * 使用AtomicBoolean确保线程安全
     */
    private val notificationSent = AtomicBoolean(false)

    /**
     * 检查是否需要发送Cookie过期通知
     * 只有第一次调用时返回true，后续调用都返回false
     *
     * @return true表示需要发送通知，false表示已经发送过
     */
    fun shouldSendNotification(): Boolean {
        return notificationSent.compareAndSet(false, true)
    }

    /**
     * 重置通知状态（用于测试或手动重置）
     */
    fun resetNotificationStatus() {
        notificationSent.set(false)
        logger.info("Cookie过期通知状态已重置")
    }

    /**
     * 获取通知发送状态
     */
    fun isNotificationSent(): Boolean {
        return notificationSent.get()
    }
}

