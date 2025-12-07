/**
 * SM4加密算法JavaScript实现
 * 提取自中国大学MOOC登录源码
 * 测试密钥: BC60B8B9E4FFEFFA219E5AD77F11F9E2
 */

// S盒
var SBOX = [
    214, 144, 233, 254, 204, 225, 61, 183, 22, 182, 20, 194, 40, 251, 44, 5,
    43, 103, 154, 118, 42, 190, 4, 195, 170, 68, 19, 38, 73, 134, 6, 153,
    156, 66, 80, 244, 145, 239, 152, 122, 51, 84, 11, 67, 237, 207, 172, 98,
    228, 179, 28, 169, 201, 8, 232, 149, 128, 223, 148, 250, 117, 143, 63, 166,
    71, 7, 167, 252, 243, 115, 23, 186, 131, 89, 60, 25, 230, 133, 79, 168,
    104, 107, 129, 178, 113, 100, 218, 139, 248, 235, 15, 75, 112, 86, 157, 53,
    30, 36, 14, 94, 99, 88, 209, 162, 37, 34, 124, 59, 1, 33, 120, 135,
    212, 0, 70, 87, 159, 211, 39, 82, 76, 54, 2, 231, 160, 196, 200, 158,
    234, 191, 138, 210, 64, 199, 56, 181, 163, 247, 242, 206, 249, 97, 21, 161,
    224, 174, 93, 164, 155, 52, 26, 85, 173, 147, 50, 48, 245, 140, 177, 227,
    29, 246, 226, 46, 130, 102, 202, 96, 192, 41, 35, 171, 13, 83, 78, 111,
    213, 219, 55, 69, 222, 253, 142, 47, 3, 255, 106, 114, 109, 108, 91, 81,
    141, 27, 175, 146, 187, 221, 188, 127, 17, 217, 92, 65, 31, 16, 90, 216,
    10, 193, 49, 136, 165, 205, 123, 189, 45, 116, 208, 18, 184, 229, 180, 176,
    137, 105, 151, 74, 12, 150, 119, 126, 101, 185, 241, 9, 197, 110, 198, 132,
    24, 240, 125, 236, 58, 220, 77, 32, 121, 238, 95, 62, 215, 203, 57, 72
];

// 系统参数FK
var FK = [462357, 472066609, 943670861, 1415275113, 1886879365, 2358483617, 2830087869, 3301692121, 3773296373, 4228057617, 404694573, 876298825, 1347903077, 1819507329, 2291111581, 2762715833, 3234320085, 3705924337, 4177462797, 337322537, 808926789, 1280531041, 1752135293, 2223739545, 2695343797, 3166948049, 3638552301, 4110090761, 269950501, 741554753, 1213159005, 1684763257];

/**
 * 将字符串转换为字节数组
 */
function stringToBytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i += 2) {
        bytes.push(parseInt(str.substr(i, 2), 16));
    }
    return bytes;
}

/**
 * 将字节数组转换为十六进制字符串
 */
function bytesToHex(bytes) {
    return bytes.map(function(byte) {
        var hex = byte.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * 循环左移
 */
function rotateLeft(value, shift) {
    return (value << shift | value >>> (32 - shift)) >>> 0;
}

/**
 * S盒变换
 */
function sboxTransform(value) {
    return ((SBOX[(value >>> 24) & 0xFF] & 0xFF) << 24) |
           ((SBOX[(value >>> 16) & 0xFF] & 0xFF) << 16) |
           ((SBOX[(value >>> 8) & 0xFF] & 0xFF) << 8) |
           (SBOX[value & 0xFF] & 0xFF);
}

/**
 * 线性变换L
 */
function linearTransform(value) {
    return (value ^ rotateLeft(value, 2) ^ rotateLeft(value, 10) ^
            rotateLeft(value, 18) ^ rotateLeft(value, 24)) >>> 0;
}

/**
 * 线性变换L'(用于密钥扩展)
 */
function linearTransformPrime(value) {
    return (value ^ rotateLeft(value, 13) ^ rotateLeft(value, 23)) >>> 0;
}

/**
 * UTF-8编码
 */
function utf8Encode(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
        var codePoint = str.codePointAt(i);
        if (codePoint <= 0x7F) {
            bytes.push(codePoint);
        } else if (codePoint <= 0x7FF) {
            bytes.push(0xC0 | (codePoint >>> 6));
            bytes.push(0x80 | (codePoint & 0x3F));
        } else if (codePoint <= 0xD7FF || (0xE000 <= codePoint && codePoint <= 0xFFFF)) {
            bytes.push(0xE0 | (codePoint >>> 12));
            bytes.push(0x80 | ((codePoint >>> 6) & 0x3F));
            bytes.push(0x80 | (codePoint & 0x3F));
        } else if (0x10000 <= codePoint && codePoint <= 0x10FFFF) {
            i++;
            bytes.push(0xF0 | ((codePoint >>> 18) & 0x1C));
            bytes.push(0x80 | ((codePoint >>> 12) & 0x3F));
            bytes.push(0x80 | ((codePoint >>> 6) & 0x3F));
            bytes.push(0x80 | (codePoint & 0x3F));
        } else {
            throw new Error("Invalid code point");
        }
    }
    return bytes;
}

/**
 * UTF-8解码
 */
function utf8Decode(bytes) {
    var result = [];
    var i = 0;
    while (i < bytes.length) {
        if (bytes[i] >= 0xF0 && bytes[i] <= 0xF7) {
            var codePoint = (((bytes[i] & 0x07) << 18) +
                            ((bytes[i + 1] & 0x3F) << 12) +
                            ((bytes[i + 2] & 0x3F) << 6) +
                            (bytes[i + 3] & 0x3F));
            result.push(String.fromCodePoint(codePoint));
            i += 3;
        } else if (bytes[i] >= 0xE0 && bytes[i] <= 0xEF) {
            var codePoint = (((bytes[i] & 0x0F) << 12) +
                            ((bytes[i + 1] & 0x3F) << 6) +
                            (bytes[i + 2] & 0x3F));
            result.push(String.fromCodePoint(codePoint));
            i += 2;
        } else if (bytes[i] >= 0xC0 && bytes[i] <= 0xDF) {
            var codePoint = (((bytes[i] & 0x1F) << 6) +
                            (bytes[i + 1] & 0x3F));
            result.push(String.fromCodePoint(codePoint));
            i++;
        } else {
            result.push(String.fromCodePoint(bytes[i]));
        }
        i++;
    }
    return result.join('');
}

/**
 * SM4加密/解密核心函数
 * @param {Array} input - 输入数据(字节数组或字符串)
 * @param {Array} key - 密钥(字节数组或十六进制字符串)
 * @param {Number} mode - 0:解密, 1:加密
 * @param {Object} options - 选项 {padding, mode, iv, output}
 * @returns {String|Array} - 加密/解密结果
 */
function sm4Crypto(input, key, mode, options) {
    options = options || {};
    var padding = options.padding || 'pkcs#5';
    var cryptoMode = options.mode;
    var iv = options.iv || [];
    var output = options.output || 'string';

    var ENCRYPT = 1;
    var DECRYPT = 0;
    var BLOCK_SIZE = 16;

    // 处理IV
    if (cryptoMode === 'cbc' && iv.length !== 16) {
        iv = typeof iv === 'string' ? stringToBytes(iv) : iv;
        if (iv.length !== 16) {
            throw new Error('iv is invalid');
        }
    }

    // 处理密钥
    key = typeof key === 'string' ? stringToBytes(key) : key;
    if (key.length !== 16) {
        throw new Error('key is invalid');
    }

    // 处理输入数据
    if (typeof input === 'string') {
        input = mode !== DECRYPT ? utf8Encode(input) : stringToBytes(input);
    }

    // PKCS#5填充(仅加密)
    if (padding === 'pkcs#5' && mode !== DECRYPT) {
        var paddingLen = BLOCK_SIZE - (input.length % BLOCK_SIZE);
        for (var i = 0; i < paddingLen; i++) {
            input.push(paddingLen);
        }
    }

    // 密钥扩展
    var roundKeys = generateRoundKeys(key, mode);

    // 加密/解密处理
    var output_bytes = [];
    var prev = iv;
    var remaining = input.length;
    var offset = 0;

    while (remaining >= BLOCK_SIZE) {
        var block = input.slice(offset, offset + BLOCK_SIZE);
        var cipher = new Array(16);

        // CBC模式预处理
        if (cryptoMode === 'cbc' && mode !== DECRYPT) {
            for (var j = 0; j < BLOCK_SIZE; j++) {
                block[j] ^= prev[j];
            }
        }

        // SM4加密/解密一个分组
        cipher = sm4Block(block, roundKeys);

        // CBC模式后处理
        if (cryptoMode === 'cbc') {
            if (mode === DECRYPT) {
                for (var j = 0; j < BLOCK_SIZE; j++) {
                    cipher[j] ^= prev[j];
                }
            }
        }

        for (var j = 0; j < BLOCK_SIZE; j++) {
            output_bytes[offset + j] = cipher[j];
        }

        if (cryptoMode === 'cbc') {
            prev = mode !== DECRYPT ? cipher : block;
        }

        remaining -= BLOCK_SIZE;
        offset += BLOCK_SIZE;
    }

    // 去除PKCS#5填充(仅解密)
    if (padding === 'pkcs#5' && mode === DECRYPT) {
        var paddingLen = output_bytes[output_bytes.length - 1];
        output_bytes.splice(output_bytes.length - paddingLen, paddingLen);
    }

    // 返回结果
    if (output !== 'array') {
        if (mode !== DECRYPT) {
            return bytesToHex(output_bytes);
        } else {
            return utf8Decode(output_bytes);
        }
    }
    return output_bytes;
}

/**
 * 生成轮密钥
 */
function generateRoundKeys(key, mode) {
    var MK = new Array(4);
    var K = new Array(4);
    var rk = new Array(32);

    // 将密钥转换为4个32位字
    for (var i = 0; i < 4; i++) {
        MK[i] = ((key[i * 4] & 0xFF) << 24) |
                ((key[i * 4 + 1] & 0xFF) << 16) |
                ((key[i * 4 + 2] & 0xFF) << 8) |
                (key[i * 4 + 3] & 0xFF);
    }

    // 生成轮密钥
    K[0] = MK[0] ^ FK[0];
    K[1] = MK[1] ^ FK[1];
    K[2] = MK[2] ^ FK[2];
    K[3] = MK[3] ^ FK[3];

    for (var i = 0; i < 32; i += 4) {
        var temp = K[1] ^ K[2] ^ K[3] ^ FK[i + 4];
        rk[i] = K[0] ^= linearTransformPrime(sboxTransform(temp));

        temp = K[2] ^ K[3] ^ K[0] ^ FK[i + 5];
        rk[i + 1] = K[1] ^= linearTransformPrime(sboxTransform(temp));

        temp = K[3] ^ K[0] ^ K[1] ^ FK[i + 6];
        rk[i + 2] = K[2] ^= linearTransformPrime(sboxTransform(temp));

        temp = K[0] ^ K[1] ^ K[2] ^ FK[i + 7];
        rk[i + 3] = K[3] ^= linearTransformPrime(sboxTransform(temp));
    }

    // 解密时需要反转轮密钥顺序
    if (mode === 0) {
        for (var i = 0; i < 16; i++) {
            var temp = rk[i];
            rk[i] = rk[31 - i];
            rk[31 - i] = temp;
        }
    }

    return rk;
}

/**
 * SM4分组加密/解密
 */
function sm4Block(block, roundKeys) {
    var X = new Array(4);
    var result = new Array(4);

    // 将输入转换为4个32位字
    for (var i = 0; i < 4; i++) {
        X[i] = ((block[i * 4] & 0xFF) << 24) |
               ((block[i * 4 + 1] & 0xFF) << 16) |
               ((block[i * 4 + 2] & 0xFF) << 8) |
               (block[i * 4 + 3] & 0xFF);
    }

    // 32轮迭代
    for (var i = 0; i < 32; i += 4) {
        var temp = X[1] ^ X[2] ^ X[3] ^ roundKeys[i];
        X[0] ^= linearTransform(sboxTransform(temp));

        temp = X[2] ^ X[3] ^ X[0] ^ roundKeys[i + 1];
        X[1] ^= linearTransform(sboxTransform(temp));

        temp = X[3] ^ X[0] ^ X[1] ^ roundKeys[i + 2];
        X[2] ^= linearTransform(sboxTransform(temp));

        temp = X[0] ^ X[1] ^ X[2] ^ roundKeys[i + 3];
        X[3] ^= linearTransform(sboxTransform(temp));
    }

    // 反序变换并输出
    var output = [];
    for (var i = 0; i < 16; i += 4) {
        output[i] = (X[3 - i / 4] >>> 24) & 0xFF;
        output[i + 1] = (X[3 - i / 4] >>> 16) & 0xFF;
        output[i + 2] = (X[3 - i / 4] >>> 8) & 0xFF;
        output[i + 3] = X[3 - i / 4] & 0xFF;
    }

    return output;
}

/**
 * 导出的SM4对象
 */
var SM4 = {
    /**
     * SM4加密
     * @param {String} plaintext - 明文
     * @param {String} key - 密钥(16字节十六进制字符串)
     * @param {Object} options - 选项
     * @returns {String} 密文(十六进制)
     */
    encrypt: function(plaintext, key, options) {
        return sm4Crypto(plaintext, key, 1, options);
    },

    /**
     * SM4解密
     * @param {String} ciphertext - 密文(十六进制)
     * @param {String} key - 密钥(16字节十六进制字符串)
     * @param {Object} options - 选项
     * @returns {String} 明文
     */
    decrypt: function(ciphertext, key, options) {
        return sm4Crypto(ciphertext, key, 0, options);
    }
};

// ============== 测试代码 ==============

console.log("=== SM4加密算法测试 ===\n");

// 测试密钥(从MOOC源码中提取)
var testKey = "BC60B8B9E4FFEFFA219E5AD77F11F9E2";

// 测试数据1: 简单字符串
var testData1 = JSON.stringify({
    channel: 0,
    rtid: "test123",
    pd: "mooc",
    pkid: "test"
});

console.log("测试1 - 加密简单JSON:");
console.log("原文:", testData1);
var encrypted1 = SM4.encrypt(testData1, testKey);
console.log("密文:", encrypted1);
var decrypted1 = SM4.decrypt(encrypted1, testKey);
console.log("解密:", decrypted1);
console.log("验证:", testData1 === decrypted1 ? "✓ 通过" : "✗ 失败");
console.log();

// 测试数据2: 包含中文
var testData2 = JSON.stringify({
    username: "测试用户",
    password: "密码123",
    action: "登录"
});

console.log("测试2 - 加密中文JSON:");
console.log("原文:", testData2);
var encrypted2 = SM4.encrypt(testData2, testKey);
console.log("密文:", encrypted2);
var decrypted2 = SM4.decrypt(encrypted2, testKey);
console.log("解密:", decrypted2);
console.log("验证:", testData2 === decrypted2 ? "✓ 通过" : "✗ 失败");
console.log();

// 测试数据3: 模拟MOOC登录参数
var testData3 = JSON.stringify({
    channel: 0,
    rtid: "AbCdEf1234567890",
    pd: "mooc",
    pkid: "qzgcGfv_jf6f0j1",
    opd: "",
    opkid: ""
});

console.log("测试3 - 模拟MOOC登录参数:");
console.log("原文:", testData3);
var encrypted3 = SM4.encrypt(testData3, testKey);
console.log("密文:", encrypted3);
var decrypted3 = SM4.decrypt(encrypted3, testKey);
console.log("解密:", decrypted3);
console.log("验证:", testData3 === decrypted3 ? "✓ 通过" : "✗ 失败");
console.log();

console.log("=== 所有测试完成 ===");
console.log();

// ============== MOOC获取票据示例 ==============

console.log("=== MOOC获取票据(getTicket)示例 ===\n");

/**
 * 生成随机rtid (32位字符串)
 * 从源码中提取: _p.getRtid = function() { ... }
 */
function generateRtid() {
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    var rtid = "";
    for (var i = 0; i < 32; i++) {
        rtid += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return rtid;
}

/**
 * 生成获取票据的encParams
 * 对应接口: POST https://reg.icourse163.org/dl/zj/mail/gt
 *
 * 源码位置:
 * - _p._$sm4Encrypt = function(e) { return window.URSSM4.encrypt(JSON.stringify(e), _sm4pubkey); }
 * - _p._$tryAddSm = function(e) { ... s = _p._$sm4Encrypt(r); ... }
 *
 * @param {String} email - 邮箱地址
 * @param {String} pkid - 产品标识 (固定值: "cjJVGQM")
 * @param {String} pd - 产品代码 (固定值: "imooc")
 * @returns {String} - encParams加密字符串
 */
function generateGetTicketParams(email, pkid, pd) {
    // 1. 准备原始参数
    var params = {
        un: email,           // 邮箱地址
        pkid: pkid || "cjJVGQM",  // 产品标识(固定)
        pd: pd || "imooc",        // 产品代码(固定)
        rtid: generateRtid()      // 随机32位字符串
    };

    console.log("原始参数:", JSON.stringify(params, null, 2));

    // 2. 转换为紧凑JSON字符串
    var jsonString = JSON.stringify(params);
    console.log("JSON字符串:", jsonString);

    // 3. 使用SM4加密
    var encrypted = SM4.encrypt(jsonString, testKey);
    console.log("加密后(encParams):", encrypted);

    return encrypted;
}

/**
 * 模拟MOOC获取票据请求
 *
 * 完整请求示例:
 * POST https://reg.icourse163.org/dl/zj/mail/gt
 * Content-Type: application/json
 * Body: {"encParams": "加密字符串"}
 */
function mockGetTicketRequest(email) {
    console.log("========================================");
    console.log("模拟获取票据请求");
    console.log("========================================");
    console.log("邮箱:", email);
    console.log();

    // 生成encParams
    var encParams = generateGetTicketParams(email, "cjJVGQM", "imooc");

    console.log();
    console.log("完整请求信息:");
    console.log("URL: POST https://reg.icourse163.org/dl/zj/mail/gt");
    console.log("Content-Type: application/json");
    console.log("Body:", JSON.stringify({ encParams: encParams }));
    console.log();
    console.log("Fetch示例代码:");
    console.log("```javascript");
    console.log("fetch('https://reg.icourse163.org/dl/zj/mail/gt', {");
    console.log("    method: 'POST',");
    console.log("    headers: {");
    console.log("        'Content-Type': 'application/json'");
    console.log("    },");
    console.log("    body: JSON.stringify({");
    console.log("        encParams: '" + encParams + "'");
    console.log("    })");
    console.log("})");
    console.log(".then(response => response.json())");
    console.log(".then(data => console.log(data))");
    console.log(".catch(error => console.error('Error:', error));");
    console.log("```");
    console.log();

    return {
        url: "https://reg.icourse163.org/dl/zj/mail/gt",
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: {
            encParams: encParams
        }
    };
}

// 测试获取票据
console.log("\n【测试1: 获取票据 - 163邮箱】");
mockGetTicketRequest("test@163.com");

console.log("\n【测试2: 获取票据 - 126邮箱】");
mockGetTicketRequest("user@126.com");

console.log("\n【测试3: 解密encParams验证】");
console.log("========================================");
// 先生成一个encParams
var testEmail = "verify@163.com";
var testParams = {
    un: testEmail,
    pkid: "cjJVGQM",
    pd: "imooc",
    rtid: generateRtid()
};
var testJson = JSON.stringify(testParams);
var testEncParams = SM4.encrypt(testJson, testKey);

console.log("原始参数:", testJson);
console.log("加密后:", testEncParams);

// 解密验证
var decrypted = SM4.decrypt(testEncParams, testKey);
console.log("解密后:", decrypted);
console.log("验证结果:", testJson === decrypted ? "✓ 加密解密一致" : "✗ 不一致");
console.log();

console.log("=== MOOC票据获取测试完成 ===");
console.log();
console.log("重要提示:");
console.log("1. SM4密钥: BC60B8B9E4FFEFFA219E5AD77F11F9E2 (从源码提取)");
console.log("2. 获取票据接口: POST /dl/zj/mail/gt");
console.log("3. 参数必须SM4加密后作为encParams提交");
console.log("4. rtid每次请求都要重新生成(32位随机字符串)");
console.log("5. pkid固定为 'cjJVGQM' (MOOC产品标识)");
console.log("6. pd固定为 'imooc' (产品代码)");
console.log();

// 如果是Node.js环境，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SM4: SM4,
        generateRtid: generateRtid,
        generateGetTicketParams: generateGetTicketParams,
        mockGetTicketRequest: mockGetTicketRequest
    };
}

