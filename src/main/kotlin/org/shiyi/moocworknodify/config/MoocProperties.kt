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
     * 注意：如果配置了自动登录（email+password），此字段可以为空
     */
    var cookie: String = "",

    /**
     * CSRF密钥，用于API请求验证
     * 获取方式：从Cookie中的NTESSTUDYSI字段获取
     * 注意：使用自动登录时会自动提取
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
     * 默认：24小时和1小时
     */
    var reminderHours: List<Int> = listOf(24, 1),


    /**
     * 登录配置（自动登录功能）
     */
    var login: LoginConfig = LoginConfig()
) {
    /**
     * 登录配置类
     */
    data class LoginConfig(
        /**
         * 是否启用自动登录
         * true: 使用无头浏览器自动登录获取Cookie
         * false: 使用手动配置的Cookie
         */
        var enabled: Boolean = false,

        /**
         * MOOC登录邮箱
         */
        var email: String = "",

        /**
         * MOOC登录密码
         */
        var password: String = "",

        /**
         * Cookie缓存文件路径
         * 用于保存登录后的Cookie，避免频繁登录
         * Cookie会一直使用，直到API返回为空时才会自动重新登录
         * 默认保存在JAR包运行目录的data文件夹下
         */
        var cookieCacheFile: String = "./data/mooc_cookies.json",

        /**
         * 浏览器配置
         */
        var browser: BrowserConfig = BrowserConfig()
    )

    /**
     * 浏览器配置类
     */
    data class BrowserConfig(
        /**
         * 是否启用无头模式
         * true: 后台运行，不显示浏览器窗口
         * false: 显示浏览器窗口（调试用）
         */
        var headless: Boolean = true,

        /**
         * 浏览器超时时间（毫秒）
         */
        var timeout: Long = 30000,

        /**
         * 登录页面URL
         */
        var loginUrl: String = "https://www.icourse163.org/member/login.htm"
    )
}


