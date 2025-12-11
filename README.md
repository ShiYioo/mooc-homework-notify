# 🎓 MOOC作业提醒系统

[![Kotlin](https://img.shields.io/badge/Kotlin-1.9.25-blue.svg)](https://kotlinlang.org/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.8-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Playwright](https://img.shields.io/badge/Playwright-1.40.0-45ba4b.svg)](https://playwright.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一个基于**无头浏览器自动登录**的MOOC作业提醒系统，可定时检查中国大学MOOC平台的作业截止时间，并通过邮件提醒用户。

## ✨ 核心特性

### 🎯 自动登录（核心功能）
- 🤖 **无头浏览器自动化**：使用Playwright模拟真实浏览器登录
- 🔐 **邮箱密码登录**：只需配置邮箱和密码，无需手动获取Cookie
- 💾 **Cookie缓存**：自动缓存登录状态，10天内无需重复登录
- 🔄 **自动刷新**：Cookie过期时自动重新登录，零人工干预
- 🛡️ **反爬绕过**：内置反检测机制，成功率高

### 📋 作业监控
- ✅ **多课程支持**：可同时监控多个课程的作业
- ⏰ **智能提醒**：支持自定义提醒时间点（默认24小时和1小时前）
- 📧 **邮件通知**：自动发送格式化的作业提醒邮件
- 🔁 **失败重试**：邮件发送失败时自动加入待发送队列
- 📊 **完成状态识别**：自动识别已完成和未完成的作业

### 🔧 系统特性
- 🐳 **Docker化部署**：一键启动，跨平台支持
- ⚙️ **可配置化设计**：所有参数均可通过配置文件管理
- 🎯 **开源友好**：代码结构清晰，遵循最佳实践
- 📝 **详细日志**：完整的日志记录，便于调试和监控

## 🆚 为什么选择无头浏览器方案？

| 对比维度 | 手动Cookie | 无头浏览器自动登录 |
|---------|-----------|-----------------|
| **配置难度** | ⭐⭐⭐ | ⭐ |
| **维护成本** | 高（每10天更新） | 低（全自动） |
| **技术门槛** | 需要懂开发者工具 | 只需填写账号密码 |
| **稳定性** | 易过期 | 自动刷新 |
| **用户体验** | 较差 | 优秀 |
| **推荐程度** | ⚠️ 不推荐 | ✅ 强烈推荐 |

## 🚀 快速开始（5分钟部署）

### 方式一：Docker部署（推荐）

#### 1. 环境要求
- Docker 20.10+
- Docker Compose 2.0+
- 2GB+ 内存

#### 2. 克隆项目
```bash
git clone https://github.com/yourusername/mooc-work-nodify.git
cd mooc-work-nodify
```

#### 3. 配置应用
```bash
# 复制配置文件
cp src/main/resources/application-example.yaml application.yaml

# 编辑配置文件
vim application.yaml
```

**关键配置项：**
```yaml
mooc:
  login:
    enabled: true  # 启用自动登录
    email: "your-email@163.com"  # MOOC登录邮箱
    password: "your-password"     # MOOC登录密码
  
  term-ids:
    - "1475440469"  # 课程学期ID（从课程URL获取）

spring:
  mail:
    host: smtp.163.com
    port: 465
    username: your-email@163.com  # 发件邮箱
    password: your-auth-code      # 邮箱授权码

notification:
  email:
    recipients:
      - "student@example.com"  # 收件人邮箱
```

#### 4. 构建并启动
```bash
# 使用部署脚本（推荐）
chmod +x deploy.sh
./deploy.sh deploy

# 或手动执行
./gradlew clean build -x test
docker-compose up -d
```

#### 5. 查看日志
```bash
docker-compose logs -f
```

### 方式二：本地运行

#### 1. 环境要求
- JDK 21+
- Gradle 8.x
- 2GB+ 内存

#### 2. 构建项目
```bash
./gradlew clean build -x test
```

#### 3. 配置应用
按照上面的配置说明编辑 `src/main/resources/application.yaml`

#### 4. 运行应用
```bash
java -jar build/libs/mooc-work-nodify-lastest.jar
```

## 📖 详细配置说明

### 获取课程学期ID（termId）

1. 访问你的课程页面
2. 查看URL，例如：`https://www.icourse163.org/learn/XXX?tid=1475440469`
3. `tid=` 后面的数字就是学期ID

或者：
1. 按F12打开开发者工具
2. 切换到Network标签
3. 刷新页面
4. 找到 `getLastLearnedMocTermDto.rpc` 请求
5. 查看请求参数中的 `termId`

### 获取邮箱授权码

**163邮箱：**
1. 登录163邮箱网页版
2. 设置 → POP3/SMTP/IMAP
3. 开启SMTP服务
4. 生成授权码（不是登录密码）

**QQ邮箱：**
1. 登录QQ邮箱网页版
2. 设置 → 账户
3. 开启SMTP服务
4. 生成授权码

### 配置项说明

| 配置项 | 说明 | 必填 | 默认值 |
|-------|------|------|-------|
| `mooc.login.enabled` | 是否启用自动登录 | 是 | false |
| `mooc.login.email` | MOOC登录邮箱 | 是 | - |
| `mooc.login.password` | MOOC登录密码 | 是 | - |
| `mooc.term-ids` | 课程学期ID列表 | 是 | [] |
| `mooc.reminder-hours` | 提醒时间点 | 否 | [24, 1] |
| `spring.mail.*` | 邮件服务器配置 | 是 | - |
| `notification.email.recipients` | 收件人列表 | 是 | [] |

## 🛠️ 管理命令

### Docker方式

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f

# 查看状态
docker-compose ps

# 进入容器
docker exec -it mooc-work-nodify sh
```

### 使用部署脚本

```bash
./deploy.sh          # 交互式菜单
./deploy.sh deploy   # 完整部署
./deploy.sh start    # 启动服务
./deploy.sh stop     # 停止服务
./deploy.sh restart  # 重启服务
./deploy.sh logs     # 查看日志
./deploy.sh status   # 查看状态
./deploy.sh clean    # 清理数据
```

## 📂 目录结构

```
mooc-work-nodify/
├── src/
│   ├── main/
│   │   ├── kotlin/
│   │   │   └── org/shiyi/moocworknodify/
│   │   │       ├── config/          # 配置类
│   │   │       ├── model/           # 数据模型
│   │   │       ├── scheduler/       # 定时任务
│   │   │       └── service/         # 业务服务
│   │   │           ├── MoocBrowserLoginService.kt  # 无头浏览器登录
│   │   │           ├── MoocApiService.kt          # MOOC API
│   │   │           ├── HomeworkReminderService.kt # 作业提醒
│   │   │           └── EmailNotificationService.kt # 邮件发送
│   │   └── resources/
│   │       ├── application.yaml         # 配置文件（需创建）
│   │       └── application-example.yaml # 配置示例
│   └── test/
├── data/                 # 数据目录（Cookie缓存等）
├── logs/                 # 日志目录
├── Dockerfile            # Docker镜像定义
├── docker-compose.yml    # Docker编排配置
├── deploy.sh             # 部署脚本
└── README.md            # 本文件
```

## ⚙️ 工作原理

### 自动登录流程

```
1. 检查Cookie缓存
   ↓ 缓存有效
   使用缓存的Cookie
   
   ↓ 缓存无效或过期
2. 启动无头浏览器（Chromium）
   ↓
3. 访问MOOC登录页面
   ↓
4. 自动填写邮箱和密码
   ↓
5. 点击登录按钮
   ↓
6. 等待登录成功
   ↓
7. 提取Cookie和CSRF密钥
   ↓
8. 保存到缓存文件
   ↓
9. 关闭浏览器
```

### 作业检查流程

```
定时器触发（每小时）
   ↓
获取有效Cookie（自动登录/缓存）
   ↓
调用MOOC API获取课程信息
   ↓
解析作业列表和截止时间
   ↓
计算剩余时间
   ↓
符合提醒时间点？
   ↓ 是
发送邮件提醒
   ↓ 失败
加入待发送队列，下次重试
```

## 🔒 安全性说明

1. **密码存储**：配置文件中的密码为明文存储，请妥善保管
2. **Cookie缓存**：Cookie缓存文件包含敏感信息，建议设置文件权限
3. **Docker部署**：建议使用volume挂载配置文件，不要打包到镜像中
4. **生产环境**：建议使用环境变量或密钥管理服务存储敏感信息

## 🐛 故障排查

### 自动登录失败

**问题1：找不到登录按钮**
- 原因：MOOC网站UI改版
- 解决：查看日志中的错误信息，检查选择器是否需要更新

**问题2：登录超时**
- 原因：网络慢或页面加载慢
- 解决：增加 `mooc.login.browser.timeout` 配置

**问题3：Docker容器中浏览器启动失败**
- 原因：缺少系统依赖
- 解决：检查Dockerfile中的依赖是否完整

### 作业检查失败

**问题：获取不到作业**
- 检查termId是否正确
- 检查Cookie是否有效
- 查看日志中的API响应

### 邮件发送失败

**问题：SMTP连接失败**
- 检查邮箱授权码是否正确
- 检查SMTP端口是否正确（163: 465, QQ: 587）
- 检查网络是否可以访问邮件服务器

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交改动 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 📄 开源协议

本项目采用MIT协议开源，详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [Playwright](https://playwright.dev/) - 强大的浏览器自动化工具
- [Spring Boot](https://spring.io/projects/spring-boot) - 优秀的Java应用框架
- [Kotlin](https://kotlinlang.org/) - 现代化的JVM语言

## 📞 联系方式

- 作者：ShiYi
- 问题反馈：[GitHub Issues](https://github.com/yourusername/mooc-work-nodify/issues)

---

⭐ 如果这个项目对你有帮助，欢迎Star支持！

1. **克隆项目**

```bash
git clone <repository-url>
cd mooc-work-nodify
```

2. **配置应用**

复制 `src/main/resources/application-example.yaml` 为 `application.yaml`，并填入您的配置信息：

```bash
cp src/main/resources/application-example.yaml src/main/resources/application.yaml
```

编辑 `application.yaml` 文件：

```yaml
# MOOC平台配置
mooc:
  cookie: "YOUR_COOKIE_HERE"        # 步骤见下方"获取配置信息"
  csrf-key: "YOUR_CSRF_KEY_HERE"
  term-ids:
    - "YOUR_TERM_ID_1"
    - "YOUR_TERM_ID_2"

# 邮件配置
spring:
  mail:
    host: smtp.example.com           # 邮件服务器
    username: your-email@example.com # 发件人邮箱
    password: your-email-password    # 邮箱授权码

# 收件人配置
notification:
  email:
    recipients:
      - "recipient@example.com"      # 收件人邮箱
```

3. **构建项目**

```bash
./gradlew build
```

4. **运行应用**

```bash
./gradlew bootRun
```

或者打包后运行：

```bash
./gradlew bootJar
java -jar build/libs/mooc-work-nodify-0.0.1-SNAPSHOT.jar
```

## 📖 获取配置信息

### 1. 获取Cookie

**⚠️ Cookie有效期说明：**
- Cookie有效期约为 **10天**（根据MOOC平台登录时的"记住我"选项和平台策略决定）
- 系统会自动检测Cookie过期并邮件通知管理员
- 建议在日历中设置提醒，每隔9天更新一次Cookie

**获取步骤：**

1. 使用Chrome/Edge浏览器登录 [中国大学MOOC](https://www.icourse163.org/)
2. **重要**：登录时勾选"记住我"或"自动登录"选项，以获得更长的Cookie有效期
3. 打开开发者工具（F12）
4. 切换到 `Network` 标签
5. 刷新页面，选择任意请求
6. 在 `Request Headers` 中找到 `Cookie` 字段
7. 复制完整的Cookie值（包括所有字段）

**验证Cookie有效性：**
```bash
# 使用curl测试Cookie是否有效
curl -H "Cookie: YOUR_COOKIE_HERE" \
     "https://www.icourse163.org/web/j/courseBean.getUserCourseBeans.rpc"

# 如果返回JSON数据（不是登录页面），说明Cookie有效
```

### 2. 获取CSRF Key

从Cookie中找到 `NTESSTUDYSI` 字段的值，该值即为csrfKey。

例如：
```
Cookie: NTESSTUDYSI=a76b9ae558784a048a62ac1d7f2cf2b4; ...
```
则csrfKey为：`a76b9ae558784a048a62ac1d7f2cf2b4`

### 3. 获取Term ID

1. 进入您要监控的课程页面
2. 在开发者工具的 `Network` 标签中
3. 找到 `getLastLearnedMocTermDto.rpc` 请求
4. 查看请求参数中的 `termId` 值

或者从课程URL中获取，例如：
```
https://www.icourse163.org/learn/XXX?tid=1475440469
```
其中 `1475440469` 就是termId。

### 4. 配置邮箱

#### QQ邮箱示例

```yaml
spring:
  mail:
    host: smtp.qq.com
    port: 587
    username: your-qq-email@qq.com
    password: your-authorization-code  # 不是QQ密码，是授权码
```

获取QQ邮箱授权码：
1. 登录QQ邮箱
2. 设置 → 账户 → POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务
3. 开启 `IMAP/SMTP服务`
4. 生成授权码

#### 163邮箱示例

```yaml
spring:
  mail:
    host: smtp.163.com
    port: 465
    username: your-163-email@163.com
    password: your-authorization-code
```

## ⚙️ 配置说明

### MOOC配置

| 配置项 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `mooc.cookie` | String | 是 | MOOC平台Cookie，用于身份验证 |
| `mooc.csrf-key` | String | 是 | CSRF密钥，从Cookie中获取 |
| `mooc.term-ids` | List<String> | 是 | 课程学期ID列表，支持多个 |
| `mooc.api-base-url` | String | 否 | API地址，默认值通常无需修改 |
| `mooc.reminder-hours` | List<Int> | 否 | 提醒时间点（小时），默认[24, 1] |

### 邮件配置

| 配置项 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `spring.mail.host` | String | 是 | 邮件服务器地址 |
| `spring.mail.port` | Int | 是 | 邮件服务器端口 |
| `spring.mail.username` | String | 是 | 发件人邮箱 |
| `spring.mail.password` | String | 是 | 邮箱授权码 |
| `notification.email.enabled` | Boolean | 否 | 是否启用邮件通知，默认true |
| `notification.email.recipients` | List<String> | 是 | 收件人邮箱列表 |
| `notification.email.subject-prefix` | String | 否 | 邮件主题前缀 |

## 📅 定时任务说明

- **检查频率**：每小时检查一次（整点执行）
- **启动检查**：应用启动后1分钟执行首次检查
- **提醒时间**：默认在作业截止前24小时和1小时提醒
- **提醒范围**：在配置的提醒时间点前后1小时内都会触发提醒
- **失败重试**：邮件发送失败时自动加入队列，下次检查时与新提醒一起发送

### 自定义定时任务

如需修改检查频率，编辑 `HomeworkCheckScheduler.kt`：

```kotlin
@Scheduled(cron = "0 0 * * * ?")  // 每小时执行
// @Scheduled(cron = "0 0 */2 * * ?")  // 每2小时执行
// @Scheduled(cron = "0 0 8,20 * * ?")  // 每天8点和20点执行
fun checkHomeworkDeadlines() {
    // ...
}
```

## 📧 邮件样式示例

```
亲爱的同学，你好！

以下作业即将截止，请及时完成：

============================================================

【作业 1】
课程名称：数据库系统原理
章节名称：第二章
作业名称：第二章作业
截止时间：2025-12-05 18:30:00
剩余时间：1天2小时
完成状态：未完成

------------------------------------------------------------

【作业 2】
课程名称：数据库系统原理
章节名称：第三章
作业名称：第三章作业
截止时间：2025-12-08 12:00:00
剩余时间：23小时
完成状态：已完成 (得分: 28.0/30.0)
⚠️ 警告：此作业即将在1小时内截止，请立即完成！

------------------------------------------------------------

温馨提示：
1. 请合理安排时间，尽早完成作业
2. 建议预留充足时间应对可能的突发情况
3. 完成作业后请确认提交成功

============================================================

此邮件由MOOC作业提醒系统自动发送，请勿回复
祝学习顺利！
```

## 🏗️ 项目结构

```
src/main/kotlin/org/shiyi/moocworknodify/
├── config/                      # 配置类
│   ├── MoocProperties.kt       # MOOC平台配置
│   ├── EmailProperties.kt      # 邮件配置
│   └── SchedulerConfig.kt      # 定时任务配置
├── model/                       # 数据模型
│   ├── MoocResponse.kt         # API响应模型
│   └── HomeworkReminder.kt     # 作业提醒模型
├── service/                     # 业务服务
│   ├── MoocApiService.kt       # MOOC API服务
│   ├── HomeworkReminderService.kt  # 作业提醒服务
│   ├── EmailNotificationService.kt # 邮件通知服务
│   └── PendingEmailService.kt  # 待发送邮件队列服务
├── scheduler/                   # 定时任务
│   └── HomeworkCheckScheduler.kt   # 作业检查调度器
└── MoocWorkNodifyApplication.kt    # 应用入口
```

## 🎯 核心设计

### 1. 配置驱动

所有敏感信息和可变参数都通过 `application.yaml` 配置，方便开源和部署。

### 2. 分层架构

- **Config Layer**: 配置管理
- **Model Layer**: 数据模型
- **Service Layer**: 业务逻辑
- **Scheduler Layer**: 定时任务

### 3. 依赖注入

使用Spring的依赖注入，代码解耦，易于测试和维护。

### 4. 异常处理

完善的异常处理和日志记录，确保系统稳定运行。

### 5. 失败重试机制

邮件发送失败时，提醒会自动加入待发送队列，下次定时检查时会与新提醒合并发送，避免因网络问题导致提醒丢失。

### 6. Cookie过期监控

系统自动检测Cookie是否过期（API返回 `code=0` 但 `result=null`），并通过线程安全的机制确保过期通知只发送一次给管理员，避免重复打扰。管理员收到通知后可及时更换Cookie，保证系统正常运行。

## 🔄 Cookie维护最佳实践

由于Cookie有效期约为10天，建议采用以下维护策略：

### 方式一：定期手动更新（推荐）

1. **设置日历提醒**：每隔9天提醒一次更新Cookie
2. **更新步骤**：
   ```bash
   # 1. 重新登录MOOC（记得勾选"记住我"）
   # 2. 获取新Cookie
   # 3. 更新配置文件
   vi src/main/resources/application.yaml
   # 4. 重启应用
   docker-compose restart  # 或 ./gradlew bootRun
   ```

3. **验证更新**：检查日志确认Cookie有效
   ```bash
   docker-compose logs -f | grep "成功获取课程信息"
   ```

### 方式二：收到通知后更新

1. 等待系统发送"Cookie已过期"邮件通知
2. 按照邮件中的步骤更新Cookie
3. 重启应用

**优缺点对比：**

| 方式 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| 定期手动更新 | 无服务中断 | 需要主动记住 | 重要课程，不能错过提醒 |
| 收到通知后更新 | 省心省力 | Cookie过期期间无法提醒 | 一般课程，可接受短暂中断 |

## 🔧 扩展开发

### 添加新的通知方式

1. 创建新的通知服务类，实现通知接口
2. 在 `HomeworkCheckScheduler` 中注入并调用

示例：添加微信通知

```kotlin
@Service
class WeChatNotificationService {
    fun sendReminders(reminders: List<HomeworkReminder>) {
        // 实现微信通知逻辑
    }
}
```

### 自定义提醒规则

修改 `HomeworkReminderService.extractHomeworkReminders()` 方法：

```kotlin
// 只提醒未完成的作业
if (shouldRemind && hoursUntilDeadline >= 0 && !isCompleted) {
    // 添加提醒
}
```

## 🐛 故障排查

### Cookie失效

**症状**：无法获取课程信息，返回错误

**解决方案**：
1. 重新登录MOOC平台
2. 获取新的Cookie
3. 更新 `application.yaml` 配置

### 邮件发送失败

**症状**：日志显示邮件发送失败

**解决方案**：
1. 检查邮箱授权码是否正确
2. 确认SMTP服务已开启
3. 检查防火墙和端口设置
4. 查看详细错误日志
5. 等待下次定时任务自动重试

### 未收到提醒

**症状**：作业即将截止但未收到邮件

**解决方案**：
1. 检查作业截止时间是否在提醒时间点范围内
2. 确认邮件通知已启用
3. 检查收件人邮箱配置
4. 查看应用日志

## 📝 开发规范

- 代码遵循Kotlin编码规范
- 使用依赖注入实现松耦合
- 完善的注释和文档
- 合理的异常处理
- 详细的日志记录

## 🐳 Docker部署

### 前置步骤：构建JAR包

在运行Docker之前，需要先构建JAR包：

```bash
# 构建JAR包
./gradlew bootJar

# 确认JAR包已生成
ls build/libs/
# 应该看到: mooc-work-nodify-0.0.1-SNAPSHOT.jar
```

### 方式一：使用Docker Compose（推荐）

1. **配置环境变量**

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑.env文件，填入你的配置
nano .env
```

2. **构建并启动服务**

```bash
# 构建镜像并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 方式二：使用配置文件

如果你更喜欢使用配置文件而不是环境变量：

1. **准备配置文件**

```bash
cp src/main/resources/application-example.yaml src/main/resources/application.yaml
# 编辑 application.yaml 填入你的配置
```

2. **修改docker-compose.yml**

取消注释配置文件挂载行：
```yaml
volumes:
  - ./src/main/resources/application.yaml:/app/config/application.yaml:ro
```

3. **启动服务**

```bash
docker-compose up -d --build
```

### 方式三：单独使用Docker

```bash
# 先构建JAR包
./gradlew bootJar

# 构建镜像
docker build -t mooc-work-nodify .

# 运行容器
docker run -d \
  --name mooc-work-nodify \
  -e MAIL_HOST=smtp.163.com \
  -e MAIL_PORT=465 \
  -e MAIL_USERNAME=your-email@163.com \
  -e MAIL_PASSWORD=your-auth-code \
  -e MOOC_COOKIE="your-cookie" \
  -e MOOC_CSRF_KEY=your-csrf-key \
  -e MOOC_TERM_IDS=1475440469 \
  -e MOOC_ADMIN_EMAIL=admin@example.com \
  -e NOTIFICATION_EMAIL_RECIPIENTS=recipient@example.com \
  mooc-work-nodify
```

### Docker常用命令

```bash
# 查看容器状态
docker-compose ps

# 查看实时日志
docker-compose logs -f mooc-work-nodify

# 重启服务
docker-compose restart

# 重新构建并启动
docker-compose up -d --build

# 停止并删除容器
docker-compose down

# 停止并删除容器及数据卷
docker-compose down -v
```

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

本项目采用 MIT 许可证。

## 👤 作者

**ShiYi**

## 🙏 致谢

感谢中国大学MOOC平台提供的优质课程资源。

---

**注意事项**：
1. 请遵守MOOC平台的使用条款
2. Cookie和csrfKey等信息请妥善保管，不要泄露
3. `application.yaml` 已添加到 `.gitignore`，请复制 `application-example.yaml` 为 `application.yaml` 进行配置
4. 本项目仅供学习交流使用

