package org.shiyi.moocworknodify.service

import org.shiyi.moocworknodify.config.EmailProperties
import org.shiyi.moocworknodify.model.HomeworkReminder
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.mail.MailException
import org.springframework.mail.SimpleMailMessage
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.stereotype.Service
import java.time.format.DateTimeFormatter

/**
 * 邮件通知服务
 * 负责发送作业提醒邮件
 * 当网络原因导致发送失败时，会将提醒暂存到待发送队列，等待下次一起发送
 *
 * @author ShiYi
 */
@Service
class EmailNotificationService(
    private val mailSender: JavaMailSender,
    private val emailProperties: EmailProperties,
    private val pendingEmailService: PendingEmailService,
    @Value("\${spring.mail.username}") private val mailFrom: String
) {
    private val logger = LoggerFactory.getLogger(javaClass)

    private val dateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")

    /**
     * 发送作业提醒邮件
     * 会自动合并之前因网络原因发送失败的待发送提醒
     *
     * @param reminders 需要提醒的作业列表
     */
    fun sendHomeworkReminders(reminders: List<HomeworkReminder>) {
        if (!emailProperties.enabled) {
            logger.info("邮件通知已禁用，跳过发送")
            return
        }

        if (emailProperties.recipients.isEmpty()) {
            logger.warn("未配置收件人邮箱 (notification.email.recipients)，跳过发送")
            return
        }

        // 合并之前待发送的提醒和本次新的提醒
        val pendingReminders = pendingEmailService.drainPendingReminders()
        val allReminders = mergeReminders(pendingReminders, reminders)

        if (allReminders.isEmpty()) {
            logger.info("没有需要提醒的作业，跳过发送邮件")
            return
        }

        if (pendingReminders.isNotEmpty()) {
            logger.info("合并了 {} 个之前待发送的提醒，本次共发送 {} 个提醒",
                pendingReminders.size, allReminders.size)
        }

        try {
            val message = SimpleMailMessage()
            message.from = mailFrom
            message.setTo(*emailProperties.recipients.toTypedArray())
            message.subject = buildEmailSubject(allReminders)
            message.text = buildEmailContent(allReminders)

            mailSender.send(message)

            logger.info("成功发送作业提醒邮件，收件人: {}, 作业数量: {}",
                emailProperties.recipients.joinToString(", "),
                allReminders.size
            )
        } catch (e: MailException) {
            // 网络原因导致发送失败，将提醒加入待发送队列
            logger.warn("邮件发送失败（网络原因），将 {} 个提醒加入待发送队列，等待下次发送", allReminders.size)
            pendingEmailService.addPendingReminders(allReminders)
            logger.error("发送作业提醒邮件失败", e)
        } catch (e: Exception) {
            // 其他异常同样加入待发送队列
            logger.warn("邮件发送失败（未知原因），将 {} 个提醒加入待发送队列，等待下次发送", allReminders.size)
            pendingEmailService.addPendingReminders(allReminders)
            logger.error("发送作业提醒邮件失败", e)
        }
    }

    /**
     * 合并待发送提醒和新提醒
     * 根据 homeworkId 去重，以新提醒为准（可能包含更新的剩余时间信息）
     */
    private fun mergeReminders(
        pendingReminders: List<HomeworkReminder>,
        newReminders: List<HomeworkReminder>
    ): List<HomeworkReminder> {
        val reminderMap = linkedMapOf<Long, HomeworkReminder>()

        // 先添加待发送的提醒
        pendingReminders.forEach { reminderMap[it.homeworkId] = it }

        // 再添加新提醒（会覆盖相同 homeworkId 的待发送提醒）
        newReminders.forEach { reminderMap[it.homeworkId] = it }

        return reminderMap.values.toList()
    }

    /**
     * 构建邮件主题
     */
    private fun buildEmailSubject(reminders: List<HomeworkReminder>): String {
        val urgentCount = reminders.count { it.remainingHours <= 1 }
        val prefix = emailProperties.subjectPrefix

        return when {
            urgentCount > 0 -> "$prefix 紧急！${urgentCount}个作业即将截止"
            else -> "$prefix ${reminders.size}个作业提醒"
        }
    }

    /**
     * 发送Cookie过期通知给管理员
     *
     * @param adminEmail 管理员邮箱
     */
    fun sendCookieExpirationNotification(adminEmail: String) {
        if (!emailProperties.enabled) {
            logger.info("邮件通知已禁用，跳过发送Cookie过期通知")
            return
        }

        if (adminEmail.isBlank()) {
            logger.warn("未配置管理员邮箱 (mooc.admin-email)，无法发送Cookie过期通知")
            return
        }

        try {
            val message = SimpleMailMessage()
            message.from = mailFrom
            message.setTo(adminEmail)
            message.subject = "${emailProperties.subjectPrefix} 系统通知：Cookie已过期"
            message.text = buildCookieExpirationContent()

            mailSender.send(message)

            logger.info("成功发送Cookie过期通知邮件到管理员: {}", adminEmail)
        } catch (e: Exception) {
            logger.error("发送Cookie过期通知邮件失败，管理员邮箱: {}", adminEmail, e)
        }
    }

    /**
     * 构建Cookie过期通知内容
     */
    private fun buildCookieExpirationContent(): String {
        val builder = StringBuilder()

        builder.appendLine("尊敬的管理员，你好！")
        builder.appendLine()
        builder.appendLine("MOOC作业提醒系统检测到Cookie已过期，无法正常获取课程信息。")
        builder.appendLine()
        builder.appendLine("=" .repeat(60))
        builder.appendLine()
        builder.appendLine("错误详情：")
        builder.appendLine("API返回：{\"code\": 0, \"result\": null}")
        builder.appendLine("这表示Cookie认证失败，需要重新获取。")
        builder.appendLine()
        builder.appendLine("=" .repeat(60))
        builder.appendLine()
        builder.appendLine("解决方法：")
        builder.appendLine("1. 登录中国大学MOOC网站：https://www.icourse163.org/")
        builder.appendLine("2. 打开浏览器开发者工具（按F12）")
        builder.appendLine("3. 切换到Network标签，刷新页面")
        builder.appendLine("4. 选择任意请求，在Request Headers中找到Cookie字段")
        builder.appendLine("5. 复制完整的Cookie值")
        builder.appendLine("6. 更新配置文件中的 mooc.cookie 配置项")
        builder.appendLine("7. 同时更新 mooc.csrf-key（从Cookie中的NTESSTUDYSI字段提取）")
        builder.appendLine("8. 重启应用")
        builder.appendLine()
        builder.appendLine("=" .repeat(60))
        builder.appendLine()
        builder.appendLine("注意事项：")
        builder.appendLine("• 在Cookie更新之前，作业提醒功能将无法正常工作")
        builder.appendLine("• 此通知只会发送一次，请及时处理")
        builder.appendLine("• 建议定期检查系统日志，确保服务正常运行")
        builder.appendLine()
        builder.appendLine("=" .repeat(60))
        builder.appendLine()
        builder.appendLine("此邮件由MOOC作业提醒系统自动发送，请勿回复")

        return builder.toString()
    }

    /**
     * 构建邮件正文
     */
    private fun buildEmailContent(reminders: List<HomeworkReminder>): String {
        val builder = StringBuilder()

        builder.appendLine("亲爱的同学，你好！")
        builder.appendLine()
        builder.appendLine("以下作业即将截止，请及时完成：")
        builder.appendLine()
        builder.appendLine("=" .repeat(60))
        builder.appendLine()

        // 按剩余时间排序，越紧急的排在前面
        val sortedReminders = reminders.sortedBy { it.remainingHours }

        sortedReminders.forEachIndexed { index, reminder ->
            builder.appendLine("【作业 ${index + 1}】")
            builder.appendLine("课程名称：${reminder.courseName}")
            builder.appendLine("章节名称：${reminder.chapterName}")
            builder.appendLine("作业名称：${reminder.homeworkName}")
            builder.appendLine("截止时间：${reminder.deadline.format(dateTimeFormatter)}")
            builder.appendLine("剩余时间：${reminder.getFormattedRemainingTime()}")
            builder.appendLine("完成状态：${reminder.getCompletionStatus()}")

            if (reminder.remainingHours <= 1) {
                builder.appendLine("⚠️ 警告：此作业即将在1小时内截止，请立即完成！")
            }

            builder.appendLine()
            builder.appendLine("-".repeat(60))
            builder.appendLine()
        }

        builder.appendLine("温馨提示：")
        builder.appendLine("1. 请合理安排时间，尽早完成作业")
        builder.appendLine("2. 建议预留充足时间应对可能的突发情况")
        builder.appendLine("3. 完成作业后请确认提交成功")
        builder.appendLine()
        builder.appendLine("=" .repeat(60))
        builder.appendLine()
        builder.appendLine("此邮件由MOOC作业提醒系统自动发送，请勿回复")
        builder.appendLine("祝学习顺利！")

        return builder.toString()
    }
}

