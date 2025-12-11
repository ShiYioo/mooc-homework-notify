plugins {
    kotlin("jvm") version "1.9.25"
    kotlin("plugin.spring") version "1.9.25"
    id("org.springframework.boot") version "3.5.8"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "org.shiyi"
version = "lastest"
description = "mooc-work-nodify"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

configurations {
    compileOnly {
        extendsFrom(configurations.annotationProcessor.get())
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")

    // HTTP客户端
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // 邮件支持
    implementation("org.springframework.boot:spring-boot-starter-mail")

    // JSON处理
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")

    // 配置属性注解处理器
    annotationProcessor("org.springframework.boot:spring-boot-configuration-processor")

    // 加密库 - Bouncy Castle
    implementation("org.bouncycastle:bcprov-jdk18on:1.78")
    implementation("org.bouncycastle:bcpkix-jdk18on:1.78")

    // Playwright - 无头浏览器自动化
    implementation("com.microsoft.playwright:playwright:1.40.0")

    // Kotlin协程
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-reactor:1.7.3")

    // 日志增强
    implementation("io.github.microutils:kotlin-logging-jvm:3.0.5")
}

kotlin {
    compilerOptions {
        freeCompilerArgs.addAll("-Xjsr305=strict")
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}
