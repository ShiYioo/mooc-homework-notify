/**
 * SM4加密工具 - 简洁版
 * 用途: MOOC登录API参数加密
 * 密钥: BC60B8B9E4FFEFFA219E5AD77F11F9E2
 */

// ==================== SM4核心算法 ====================

// S盒
var SBOX = [214,144,233,254,204,225,61,183,22,182,20,194,40,251,44,5,43,103,154,118,42,190,4,195,170,68,19,38,73,134,6,153,156,66,80,244,145,239,152,122,51,84,11,67,237,207,172,98,228,179,28,169,201,8,232,149,128,223,148,250,117,143,63,166,71,7,167,252,243,115,23,186,131,89,60,25,230,133,79,168,104,107,129,178,113,100,218,139,248,235,15,75,112,86,157,53,30,36,14,94,99,88,209,162,37,34,124,59,1,33,120,135,212,0,70,87,159,211,39,82,76,54,2,231,160,196,200,158,234,191,138,210,64,199,56,181,163,247,242,206,249,97,21,161,224,174,93,164,155,52,26,85,173,147,50,48,245,140,177,227,29,246,226,46,130,102,202,96,192,41,35,171,13,83,78,111,213,219,55,69,222,253,142,47,3,255,106,114,109,108,91,81,141,27,175,146,187,221,188,127,17,217,92,65,31,16,90,216,10,193,49,136,165,205,123,189,45,116,208,18,184,229,180,176,137,105,151,74,12,150,119,126,101,185,241,9,197,110,198,132,24,240,125,236,58,220,77,32,121,238,95,62,215,203,57,72];

// 系统参数FK
var FK = [462357,472066609,943670861,1415275113,1886879365,2358483617,2830087869,3301692121,3773296373,4228057617,404694573,876298825,1347903077,1819507329,2291111581,2762715833,3234320085,3705924337,4177462797,337322537,808926789,1280531041,1752135293,2223739545,2695343797,3166948049,3638552301,4110090761,269950501,741554753,1213159005,1684763257];

function hexToBytes(hex) {
    var bytes = [];
    for (var i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

function bytesToHex(bytes) {
    return bytes.map(function(b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
}

function rotl(x, n) {
    return (x << n | x >>> (32 - n)) >>> 0;
}

function sbox(x) {
    return ((SBOX[x >>> 24 & 0xFF] & 0xFF) << 24) | ((SBOX[x >>> 16 & 0xFF] & 0xFF) << 16) | ((SBOX[x >>> 8 & 0xFF] & 0xFF) << 8) | (SBOX[x & 0xFF] & 0xFF);
}

function L(x) {
    return (x ^ rotl(x, 2) ^ rotl(x, 10) ^ rotl(x, 18) ^ rotl(x, 24)) >>> 0;
}

function Lprime(x) {
    return (x ^ rotl(x, 13) ^ rotl(x, 23)) >>> 0;
}

function utf8Encode(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
        var c = str.codePointAt(i);
        if (c <= 0x7F) bytes.push(c);
        else if (c <= 0x7FF) { bytes.push(0xC0 | c >>> 6); bytes.push(0x80 | c & 0x3F); }
        else if (c <= 0xD7FF || (0xE000 <= c && c <= 0xFFFF)) { bytes.push(0xE0 | c >>> 12); bytes.push(0x80 | c >>> 6 & 0x3F); bytes.push(0x80 | c & 0x3F); }
        else if (0x10000 <= c && c <= 0x10FFFF) { i++; bytes.push(0xF0 | c >>> 18 & 0x1C); bytes.push(0x80 | c >>> 12 & 0x3F); bytes.push(0x80 | c >>> 6 & 0x3F); bytes.push(0x80 | c & 0x3F); }
    }
    return bytes;
}

function genRoundKeys(key, mode) {
    var MK = [], K = [], rk = [];
    for (var i = 0; i < 4; i++) MK[i] = ((key[i*4] & 0xFF) << 24) | ((key[i*4+1] & 0xFF) << 16) | ((key[i*4+2] & 0xFF) << 8) | (key[i*4+3] & 0xFF);
    K[0] = MK[0] ^ FK[0]; K[1] = MK[1] ^ FK[1]; K[2] = MK[2] ^ FK[2]; K[3] = MK[3] ^ FK[3];
    for (var i = 0; i < 32; i += 4) {
        rk[i] = K[0] ^= Lprime(sbox(K[1] ^ K[2] ^ K[3] ^ FK[i+4]));
        rk[i+1] = K[1] ^= Lprime(sbox(K[2] ^ K[3] ^ K[0] ^ FK[i+5]));
        rk[i+2] = K[2] ^= Lprime(sbox(K[3] ^ K[0] ^ K[1] ^ FK[i+6]));
        rk[i+3] = K[3] ^= Lprime(sbox(K[0] ^ K[1] ^ K[2] ^ FK[i+7]));
    }
    if (mode === 0) for (var i = 0; i < 16; i++) { var t = rk[i]; rk[i] = rk[31-i]; rk[31-i] = t; }
    return rk;
}

function sm4Block(block, rk) {
    var X = [];
    for (var i = 0; i < 4; i++) X[i] = ((block[i*4] & 0xFF) << 24) | ((block[i*4+1] & 0xFF) << 16) | ((block[i*4+2] & 0xFF) << 8) | (block[i*4+3] & 0xFF);
    for (var i = 0; i < 32; i += 4) {
        X[0] ^= L(sbox(X[1] ^ X[2] ^ X[3] ^ rk[i]));
        X[1] ^= L(sbox(X[2] ^ X[3] ^ X[0] ^ rk[i+1]));
        X[2] ^= L(sbox(X[3] ^ X[0] ^ X[1] ^ rk[i+2]));
        X[3] ^= L(sbox(X[0] ^ X[1] ^ X[2] ^ rk[i+3]));
    }
    var out = [];
    for (var i = 0; i < 16; i += 4) {
        out[i] = X[3-i/4] >>> 24 & 0xFF;
        out[i+1] = X[3-i/4] >>> 16 & 0xFF;
        out[i+2] = X[3-i/4] >>> 8 & 0xFF;
        out[i+3] = X[3-i/4] & 0xFF;
    }
    return out;
}

function sm4Encrypt(plaintext, keyHex) {
    var key = hexToBytes(keyHex);
    if (key.length !== 16) throw new Error('密钥必须是16字节(32位十六进制)');

    var input = utf8Encode(plaintext);
    var pad = 16 - input.length % 16;
    for (var i = 0; i < pad; i++) input.push(pad);

    var rk = genRoundKeys(key, 1);
    var output = [];

    for (var offset = 0; offset < input.length; offset += 16) {
        var block = input.slice(offset, offset + 16);
        var cipher = sm4Block(block, rk);
        output = output.concat(cipher);
    }

    return bytesToHex(output);
}

// ==================== MOOC工具函数 ====================

var MOOC_KEY = "BC60B8B9E4FFEFFA219E5AD77F11F9E2";

/**
 * 生成随机rtid
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
 * 加密MOOC参数
 * @param {Object} params - 参数对象
 * @returns {String} - 加密后的encParams
 */
function encryptMoocParams(params) {
    var json = JSON.stringify(params);
    return sm4Encrypt(json, MOOC_KEY);
}

/**
 * 生成获取票据的encParams
 * @param {String} email - 邮箱地址
 * @returns {String} - encParams
 */
function getTicketEncParams(email) {
    var params = {
        un: email,
        pkid: "cjJVGQM",
        pd: "imooc",
        rtid: generateRtid()
    };
    return encryptMoocParams(params);
}

/**
 * 生成登录的encParams
 * @param {String} email - 邮箱地址
 * @param {String} password - 密码(已加密)
 * @returns {String} - encParams
 */
function loginEncParams(email, password) {
    var params = {
        un: email,
        pd: password,
        pkid: "cjJVGQM",
        product: "imooc",
        rtid: generateRtid()
    };
    return encryptMoocParams(params);
}

// ==================== 导出 ====================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sm4Encrypt: sm4Encrypt,
        encryptMoocParams: encryptMoocParams,
        getTicketEncParams: getTicketEncParams,
        loginEncParams: loginEncParams,
        generateRtid: generateRtid,
        MOOC_KEY: MOOC_KEY
    };
}

// ==================== 使用示例 ====================

if (typeof require === 'undefined') {
    console.log("=== SM4 MOOC加密工具 ===\n");

    // 示例1: 加密任意JSON
    console.log("【示例1】加密JSON对象:");
    var testData = {"un":"test@163.com","pkid":"cjJVGQM","pd":"imooc","rtid":generateRtid};
    var encrypted = sm4Encrypt(JSON.stringify(testData), MOOC_KEY);
    console.log("原始数据:", JSON.stringify(testData));
    console.log("加密结果:", encrypted);
    console.log();

    // 示例2: 获取票据
    // console.log("【示例2】生成获取票据的encParams:");
    // var email = "test@163.com";
    // var ticketEnc = getTicketEncParams(email);
    // console.log("邮箱:", email);
    // console.log("encParams:", ticketEnc);
    // console.log();
    // console.log("请求示例:");
    // console.log("POST https://reg.icourse163.org/dl/zj/mail/gt");
    // console.log('Body: {"encParams":"' + ticketEnc + '"}');
    // console.log();
    //
    // // 示例3: 登录
    // console.log("【示例3】生成登录的encParams:");
    // var loginEnc = loginEncParams("user@163.com", "encryptedPassword123");
    // console.log("encParams:", loginEnc);
    // console.log();
    //
    // console.log("提示: 在Node.js中使用:");
    // console.log("const sm4 = require('./sm4-encrypt-tool.js');");
    // console.log("const encParams = sm4.getTicketEncParams('your@email.com');");
}

