# 使用带有浏览器支持的基础镜像
# Playwright需要较多的系统库，使用标准Debian镜像而非Alpine
FROM eclipse-temurin:21-jre

LABEL maintainer="ShiYi"
LABEL description="MOOC作业提醒服务 - 使用无头浏览器自动登录并监控作业截止时间"

# 设置工作目录
WORKDIR /app

# 安装Playwright所需的系统依赖
# 参考：https://playwright.dev/docs/browsers#install-system-dependencies
RUN apt-get update && apt-get install -y \
    # Chromium运行所需的基础库
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    # 字体支持（中文显示）
    fonts-liberation \
    fonts-noto-cjk \
    # 其他必要工具
    ca-certificates \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# 设置时区为中国
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Playwright浏览器缓存目录
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# 创建数据目录（用于存储Cookie缓存）
RUN mkdir -p /app/data /app/logs

# 复制应用JAR文件
COPY build/libs/*.jar app.jar

# 复制配置文件（如果存在）
# 注意：实际部署时应通过volume挂载配置文件
COPY src/main/resources/application.yaml* /app/ 2>/dev/null || true

# 暴露端口（如果有Web界面）
# EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD test -f /app/logs/mooc-work-notify.log || exit 1

# 运行应用
# 使用JAVA_OPTS环境变量传递JVM参数
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
