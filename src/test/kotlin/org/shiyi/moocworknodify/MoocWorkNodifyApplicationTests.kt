package org.shiyi.moocworknodify

import org.junit.jupiter.api.Test
import org.shiyi.moocworknodify.util.RsaEncryptionTool
import org.springframework.boot.test.context.SpringBootTest

@SpringBootTest
class MoocWorkNodifyApplicationTests {

    @Test
    fun contextLoads() {
    }

    @Test
    fun encryptWithPublicKey(){
        val encryptPassword = RsaEncryptionTool.encryptPassword("test")
        println(encryptPassword)
    }

}
