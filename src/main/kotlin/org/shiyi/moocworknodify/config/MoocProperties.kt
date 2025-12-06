package org.shiyi.moocworknodify.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.stereotype.Component

/**
 * MOOC平台配置属性
 *
 * @author ShiYi
 */
@Component
@ConfigurationProperties(prefix = "mooc")
data class MoocProperties(
    /**
     * MOOC平台Cookie，用于身份验证
     * 获取方式：登录MOOC网站后，从浏览器开发者工具中复制Cookie
     */
    var cookie: String = "",

    /**
     * CSRF密钥，用于API请求验证
     * 获取方式：从Cookie中的NTESSTUDYSI字段获取
     */
    var csrfKey: String = "",

    /**
     * 课程学期ID列表，支持监控多个课程
     * 获取方式：访问课程页面，从URL或API请求中获取termId
     */
    var termIds: List<String> = emptyList(),

    /**
     * API基础URL
     */
    var apiBaseUrl: String = "https://www.icourse163.org/web/j/courseBean.getLastLearnedMocTermDto.rpc",

    /**
     * 作业提醒时间点配置（距离截止时间的小时数）
     * 默认：24小时和1小时
     */
    var reminderHours: List<Int> = listOf(24, 1),

    /**
     * 管理员邮箱，用于接收系统通知（如Cookie过期）
     */
    var adminEmail: String = ""
)


