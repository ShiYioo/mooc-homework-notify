package org.shiyi.moocworknodify.util

import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.bouncycastle.util.encoders.Base64
import java.security.KeyFactory
import java.security.Security
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher

/**
 * RSA加密工具类
 * 用于MOOC登录密码加密
 */
object RsaEncryptionTool {

    // MOOC RSA公钥（PEM格式）
    private const val MOOC_PUBLIC_KEY_PEM = """
-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC5gsH+AA4XWONB5TDcUd+xCz7e
jOFHZKlcZDx+pF1i7Gsvi1vjyJoQhRtRSn950x498VUkx7rUxg1/ScBVfrRxQOZ8
xFBye3pjAzfb22+RCuYApSVpJ3OO3KsEuKExftz9oFBv3ejxPlYc5yq7YiBO8XlT
nQN0Sa4R4qhPO3I2MQIDAQAB
-----END PUBLIC KEY-----
"""

    init {
        // 添加BouncyCastle作为安全提供者
        Security.addProvider(BouncyCastleProvider())
    }

    /**
     * 使用RSA公钥加密密码
     *
     * @param password 明文密码
     * @return Base64编码的加密结果
     */
    fun encryptPassword(password: String): String {
        return encryptWithPublicKey(password, MOOC_PUBLIC_KEY_PEM)
    }

    /**
     * 使用指定的RSA公钥加密文本
     *
     * @param plainText 明文
     * @param publicKeyPem PEM格式的公钥
     * @return Base64编码的加密结果
     */
    fun encryptWithPublicKey(plainText: String, publicKeyPem: String): String {
        // 解析公钥
        val publicKey = parsePublicKey(publicKeyPem)

        // 创建Cipher实例，使用PKCS1填充模式
        val cipher = Cipher.getInstance("RSA/ECB/PKCS1Padding", "BC")
        cipher.init(Cipher.ENCRYPT_MODE, publicKey)

        // 加密
        val encryptedBytes = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))

        // Base64编码
        return String(Base64.encode(encryptedBytes))
    }

    /**
     * 解析PEM格式的公钥
     */
    private fun parsePublicKey(publicKeyPem: String): java.security.PublicKey {
        // 移除PEM头尾和换行符
        val publicKeyContent = publicKeyPem
            .replace("-----BEGIN PUBLIC KEY-----", "")
            .replace("-----END PUBLIC KEY-----", "")
            .replace("\n", "")
            .replace("\r", "")
            .trim()

        // Base64解码
        val keyBytes = Base64.decode(publicKeyContent)

        // 使用X509EncodedKeySpec解析公钥
        val keySpec = X509EncodedKeySpec(keyBytes)
        val keyFactory = KeyFactory.getInstance("RSA", "BC")

        return keyFactory.generatePublic(keySpec)
    }

    /**
     * 格式化输出公钥信息（用于调试）
     */
    fun printPublicKeyInfo() {
        val publicKey = parsePublicKey(MOOC_PUBLIC_KEY_PEM)
        val keyFactory = KeyFactory.getInstance("RSA", "BC")
        val keySpec = keyFactory.getKeySpec(publicKey, java.security.spec.RSAPublicKeySpec::class.java) as java.security.spec.RSAPublicKeySpec

        println("RSA公钥信息:")
        println("模数(Modulus): ${keySpec.modulus.toString(16).uppercase()}")
        println("指数(Exponent): ${keySpec.publicExponent}")
        println("密钥长度: ${keySpec.modulus.bitLength()} bits")
    }
}

