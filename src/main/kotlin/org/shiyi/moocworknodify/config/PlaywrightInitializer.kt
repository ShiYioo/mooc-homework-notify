package org.shiyi.moocworknodify.config

import com.microsoft.playwright.Playwright
import mu.KotlinLogging
import org.springframework.boot.context.event.ApplicationStartedEvent
import org.springframework.context.event.EventListener
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Playwright浏览器初始化器
 *
 * 在应用启动时确保Playwright浏览器已下载完成
 *
 * @author ShiYi
 */
@Component
@Order(0) // 最高优先级
class PlaywrightInitializer {

    private val logger = KotlinLogging.logger {}

    companion object {
        private val initialized = AtomicBoolean(false)

        /**
         * 检查Playwright是否已初始化
         */
        fun isInitialized(): Boolean = initialized.get()

        /**
         * 等待Playwright初始化完成
         */
        fun waitForInitialization(timeoutMs: Long = 120000) {
            val startTime = System.currentTimeMillis()
            while (!isInitialized()) {
                if (System.currentTimeMillis() - startTime > timeoutMs) {
                    throw IllegalStateException("Playwright初始化超时")
                }
                Thread.sleep(1000)
            }
        }
    }

    /**
     * 在应用启动时初始化Playwright
     * 使用 ApplicationStartedEvent 确保在所有Bean初始化之前执行
     */
    @EventListener(ApplicationStartedEvent::class)
    fun initializePlaywright() {
        if (initialized.get()) {
            logger.info { "Playwright已初始化，跳过" }
            return
        }

        logger.info { "=" .repeat(60) }
        logger.info { "开始初始化Playwright浏览器..." }
        logger.info { "首次运行时会自动下载Chromium浏览器，请耐心等待" }
        logger.info { "=" .repeat(60) }

        try {
            val startTime = System.currentTimeMillis()
            var lastProgressMessage = ""

            while (!initialized.get()) {
                try {
                    // 创建Playwright实例并尝试启动浏览器
                    val playwright = Playwright.create()
                    val browser = playwright.chromium().launch()
                    browser.close()
                    playwright.close()

                    // 成功！
                    initialized.set(true)

                    val elapsedSeconds = (System.currentTimeMillis() - startTime) / 1000
                    logger.info { "=" .repeat(60) }
                    logger.info { "✅ Playwright浏览器初始化完成 (耗时: ${elapsedSeconds}秒)" }
                    logger.info { "=" .repeat(60) }

                } catch (e: Exception) {
                    val message = e.message ?: ""

                    // 根据错误消息判断当前状态
                    val currentProgress = when {
                        message.contains("downloading") -> "正在下载浏览器..."
                        message.contains("Failed to launch") -> "浏览器下载中，准备启动..."
                        message.contains("executable doesn't exist") -> "浏览器文件准备中..."
                        message.contains("Host system is missing dependencies") -> {
                            // 这是系统依赖缺失，不是下载问题，直接抛出
                            throw e
                        }
                        else -> "初始化中..."
                    }

                    // 只在进度消息变化时打印，避免刷屏
                    if (currentProgress != lastProgressMessage) {
                        logger.info { "⏳ $currentProgress" }
                        lastProgressMessage = currentProgress
                    }

                    // 等待一小段时间再重试
                    Thread.sleep(2000)

                    // 超时检查（5分钟）
                    val elapsedSeconds = (System.currentTimeMillis() - startTime) / 1000
                    if (elapsedSeconds > 300) {
                        throw IllegalStateException("Playwright初始化超时（超过5分钟），请检查网络连接")
                    }
                }
            }

        } catch (e: Exception) {
            logger.error(e) { "❌ Playwright浏览器初始化失败" }
            logger.error { "错误信息: ${e.message}" }
            logger.error { "=" .repeat(60) }
            logger.error { "请检查网络连接或系统依赖是否完整" }
            throw e
        }
    }
}

