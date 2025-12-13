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

> ⚠️ **重要提示**：由于Playwright在Docker环境下的Cookie获取限制，**自动登录功能目前仅在Windows/macOS物理机环境下稳定运行**。Docker部署方式存在Cookie不完整问题，建议在物理机上运行。详见[故障排查](#故障排查)部分。

### 方式一：Docker部署（存在已知限制）

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

### 方式二：本地运行（推荐）

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

## 📂 代码结构

```
src/main/kotlin/org/shiyi/moocworknodify/
├── config/                          # 配置类
│   ├── AppConfig.kt                # 应用配置
│   ├── ApplicationStartupListener.kt # 启动监听器
│   └── SchedulerConfig.kt          # 定时任务配置
├── model/                           # 数据模型
│   ├── CourseInfo.kt               # 课程信息
│   ├── Homework.kt                 # 作业模型
│   └── MoocCookie.kt               # Cookie模型
├── scheduler/                       # 定时任务
│   └── HomeworkCheckScheduler.kt   # 作业检查调度器
├── service/                         # 业务服务
│   ├── MoocBrowserLoginService.kt  # 🌟 无头浏览器自动登录
│   ├── MoocApiService.kt           # MOOC API调用
│   ├── HomeworkReminderService.kt  # 作业提醒服务
│   └── EmailNotificationService.kt # 邮件通知服务
└── MoocWorkNodifyApplication.kt    # 应用入口
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

**⚠️ 问题3：Docker环境下获取的Cookie不完整（已知限制）**
- **现象**：在Windows上运行正常，但在基于官方 `mcr.microsoft.com/playwright/java` 镜像的Docker容器中获取的Cookie不完整（缺少NTES_SESS、STUDY_SESS、STUDY_INFO等关键Cookie）
- **根本原因**：
  - Playwright在Docker环境下使用的Chromium浏览器可能对第三方Cookie的处理策略与Windows环境不同
  - Docker容器中的Chromium可能因网络隔离或系统环境差异，导致部分Cookie无法正确设置
  - MOOC网站的Cookie设置机制依赖于特定的浏览器特性，在容器化环境中可能无法完全模拟
- **当前状态**：
  - ✅ **Windows环境**：测试通过，稳定运行
  - ⚠️ **Docker环境**：存在Cookie不完整问题，导致自动登录功能受限
- **临时解决方案**：
  1. **推荐**：在Windows物理机上直接运行（使用JDK 21+）
  2. 不推荐：在Docker环境中运行（可能需要手动配置Cookie）
- **技术限制说明**：
  - 这是Playwright + Docker + 特定网站Cookie机制的组合限制
  - 并非代码逻辑错误，而是运行环境的差异导致
  - 欢迎有Docker自动化经验的开发者提供解决方案

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
