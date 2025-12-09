/**
 * MOOC登录第二步工具：密码加密 + 执行登录
 *
 * 功能：
 * 1. 使用RSA公钥加密密码（PKCS#1 v1.5，1024位）
 * 2. 准备完整的登录参数（13个必填字段 + 可选的pVParam）
 * 3. 使用SM4加密整个请求参数（ECB模式，PKCS7填充）
 * 4. 生成可直接POST的encParams
 *
 * 登录参数结构（必须包含13个必填字段，按顺序）：
 * 1. un - 邮箱地址
 * 2. pw - RSA加密后的密码（Base64格式，约172字符）
 * 3. pd - 产品代码，固定值 "imooc"
 * 4. l - 是否记住登录，0=否，1=是
 * 5. d - 记住登录天数，通常为10
 * 6. t - 当前时间戳（毫秒）
 * 7. pkid - 产品标识，固定值 "cjJVGQM"
 * 8. domains - 域名列表，可为空字符串
 * 9. tk - 第一步获取的ticket
 * 10. pwdKeyUp - 密码输入方式，0=非键盘，1=键盘
 * 11. channel - 渠道标识，固定值 0
 * 12. topURL - 来源URL，固定值 "https://www.icourse163.org/"
 * 13. rtid - 请求追踪ID，32位随机字符串（0-9A-Za-z）
 *
 * 可选字段（仅在触发Power验证时添加）：
 * 14. pVParam - Power验证参数对象，包含：
 *     - puzzle: Base64编码的VDF难题
 *     - spendTime: 计算耗时（毫秒）
 *     - runTimes: 运算次数
 *     - sid: 验证会话ID（从powGetP接口获取）
 *     - args: VDF计算结果（JSON字符串）
 *
 * Power验证流程：
 * 1. 首次登录：使用基础参数（13个必填字段，不含pVParam）
 * 2. 如果返回错误码805/806：需要Power验证
 *    a. 调用 GET https://reg.icourse163.org/dl/zj/mail/powGetP?pvSid=xxx
 *    b. 前端执行VDF计算，生成pVParam
 *    c. 将pVParam添加到参数中
 *    d. 重新发送登录请求（此时包含14个字段）
 * 3. 正常情况：直接使用13个字段即可成功登录
 *
 * 用法：
 *   测试模式: node login-step2-tool.js
 *   实际使用: node login-step2-tool.js <email> <password> <ticket>
 *
 * 源码依据：
 *   webzj_cdn101_pp_index_dl_*.js 中的 __doLoginReal 和 __sendLogin 函数
 *
 * 作者：ShiYi
 * 日期：2024-12-08
 * 更新：2024-12-08 - 添加完整的13个必填字段说明和Power验证支持
 */

// ============================================
// 第一部分：RSA加密实现（从MOOC源码提取）
// ============================================

/**
 * BigInteger 大整数运算库（精简版）
 * 用于RSA加密的模幂运算
 */
class BigInteger {
    constructor(value, radix) {
        if (typeof value === 'string') {
            this.fromString(value, radix || 10);
        } else if (typeof value === 'number') {
            this.fromInt(value);
        } else if (Array.isArray(value)) {
            this.data = value;
            this.s = 0;
            this.t = value.length;
        }
    }

    fromString(str, radix) {
        this.data = [];
        this.s = 0;
        this.t = 0;

        if (radix === 16) {
            // 十六进制转换
            const k = 4;
            const km = (1 << k) - 1;
            let d = 0, m = false, sh = 0;

            for (let i = str.length - 1; i >= 0; i--) {
                const x = this.intAt(str, i);
                if (x < 0) continue;
                m = true;
                d |= x << sh;
                sh += k;
                if (sh >= 26) {
                    this.data[this.t++] = d & 0x3ffffff;
                    d >>= 26;
                    sh -= 26;
                }
            }
            if (m && d > 0) {
                this.data[this.t++] = d;
            }
        }
        this.clamp();
    }

    fromInt(x) {
        this.data = [];
        this.t = 1;
        this.s = x < 0 ? -1 : 0;
        if (x > 0) this.data[0] = x;
        else if (x < -1) this.data[0] = x + this.DV;
        else this.t = 0;
    }

    intAt(str, i) {
        const c = str.charCodeAt(i);
        if (c >= 48 && c <= 57) return c - 48;
        if (c >= 65 && c <= 90) return c - 55;
        if (c >= 97 && c <= 122) return c - 87;
        return -1;
    }

    clamp() {
        const c = this.s & 0x3ffffff;
        while (this.t > 0 && this.data[this.t - 1] === c) --this.t;
    }

    toString(radix) {
        if (this.s < 0) return "-" + this.negate().toString(radix);
        let k = 1;
        if (radix === 16) k = 4;
        const km = (1 << k) - 1;
        let d, m = false, r = "", i = this.t;
        let p = 26 - (i * 26) % k;

        if (i-- > 0) {
            if (p < 26 && (d = this.data[i] >> p) > 0) {
                m = true;
                r = d.toString(16);
            }
            while (i >= 0) {
                if (p < k) {
                    d = (this.data[i] & ((1 << p) - 1)) << (k - p);
                    d |= this.data[--i] >> (p += 26 - k);
                } else {
                    d = (this.data[i] >> (p -= k)) & km;
                    if (p <= 0) {
                        p += 26;
                        --i;
                    }
                }
                if (d > 0) m = true;
                if (m) r += d.toString(16);
            }
        }
        return m ? r : "0";
    }

    negate() {
        const r = new BigInteger();
        BigInteger.ZERO.subTo(this, r);
        return r;
    }

    bitLength() {
        if (this.t <= 0) return 0;
        return 26 * (this.t - 1) + this.nbits(this.data[this.t - 1]);
    }

    nbits(x) {
        let r = 1, t;
        if ((t = x >>> 16) !== 0) { x = t; r += 16; }
        if ((t = x >> 8) !== 0) { x = t; r += 8; }
        if ((t = x >> 4) !== 0) { x = t; r += 4; }
        if ((t = x >> 2) !== 0) { x = t; r += 2; }
        if ((t = x >> 1) !== 0) { x = t; r += 1; }
        return r;
    }

    modPowInt(e, m) {
        let z;
        if (e < 256) {
            z = new Classic(m);
        } else {
            z = new Montgomery(m);
        }
        return this.exp(e, z);
    }

    exp(e, z) {
        if (e > 0xffffffff || e < 1) return BigInteger.ONE;
        let r = new BigInteger(), r2 = new BigInteger();
        const g = z.convert(this);
        let i = this.nbits(e) - 1;
        g.copyTo(r);
        while (--i >= 0) {
            z.sqrTo(r, r2);
            if ((e & (1 << i)) > 0) z.mulTo(r2, g, r);
            else { const t = r; r = r2; r2 = t; }
        }
        return z.revert(r);
    }

    copyTo(r) {
        for (let i = this.t - 1; i >= 0; --i) r.data[i] = this.data[i];
        r.t = this.t;
        r.s = this.s;
    }

    subTo(a, r) {
        let i = 0, c = 0, m = Math.min(a.t, this.t);
        while (i < m) {
            c += this.data[i] - a.data[i];
            r.data[i++] = c & 0x3ffffff;
            c >>= 26;
        }
        if (a.t < this.t) {
            c -= a.s;
            while (i < this.t) {
                c += this.data[i];
                r.data[i++] = c & 0x3ffffff;
                c >>= 26;
            }
            c += this.s;
        } else {
            c += this.s;
            while (i < a.t) {
                c -= a.data[i];
                r.data[i++] = c & 0x3ffffff;
                c >>= 26;
            }
            c -= a.s;
        }
        r.s = c < 0 ? -1 : 0;
        if (c < -1) r.data[i++] = 0x4000000 + c;
        else if (c > 0) r.data[i++] = c;
        r.t = i;
        r.clamp();
    }
}

BigInteger.prototype.DV = 0x4000000;
BigInteger.ZERO = new BigInteger(0);
BigInteger.ONE = new BigInteger(1);

// Classic reduction (简化版)
class Classic {
    constructor(m) {
        this.m = m;
    }
    convert(x) {
        if (x.s < 0 || x.compareTo(this.m) >= 0) return x.mod(this.m);
        else return x;
    }
    revert(x) { return x; }
    mulTo(x, y, r) { x.multiplyTo(y, r); this.reduce(r); }
    sqrTo(x, r) { x.squareTo(r); this.reduce(r); }
    reduce(x) { x.divRemTo(this.m, null, x); }
}

// Montgomery reduction (简化版)
class Montgomery {
    constructor(m) {
        this.m = m;
        this.mp = m.invDigit();
        this.mpl = this.mp & 0x7fff;
        this.mph = this.mp >> 15;
        this.um = (1 << (26 - 15)) - 1;
        this.mt2 = 2 * m.t;
    }
    convert(x) {
        const r = new BigInteger();
        x.abs().dlShiftTo(this.m.t, r);
        r.divRemTo(this.m, null, r);
        if (x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r, r);
        return r;
    }
    revert(x) {
        const r = new BigInteger();
        x.copyTo(r);
        this.reduce(r);
        return r;
    }
    mulTo(x, y, r) { x.multiplyTo(y, r); this.reduce(r); }
    sqrTo(x, r) { x.squareTo(r); this.reduce(r); }
    reduce(x) {
        while (x.t <= this.mt2) x.data[x.t++] = 0;
        for (let i = 0; i < this.m.t; ++i) {
            let j = x.data[i] & 0x7fff;
            const u0 = (j * this.mpl + (((j * this.mph + (x.data[i] >> 15) * this.mpl) & this.um) << 15)) & 0x3ffffff;
            j = i + this.m.t;
            x.data[j] += this.m.am(0, u0, x, i, 0, this.m.t);
            while (x.data[j] >= x.DV) { x.data[j] -= x.DV; x.data[++j]++; }
        }
        x.clamp();
        x.drShiftTo(this.m.t, x);
        if (x.compareTo(this.m) >= 0) x.subTo(this.m, x);
    }
}

// 添加必要的BigInteger方法
BigInteger.prototype.compareTo = function(a) {
    let r = this.s - a.s;
    if (r !== 0) return r;
    let i = this.t;
    r = i - a.t;
    if (r !== 0) return this.s < 0 ? -r : r;
    while (--i >= 0) if ((r = this.data[i] - a.data[i]) !== 0) return r;
    return 0;
};

BigInteger.prototype.mod = function(a) {
    const r = new BigInteger();
    this.abs().divRemTo(a, null, r);
    if (this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r, r);
    return r;
};

BigInteger.prototype.abs = function() {
    return this.s < 0 ? this.negate() : this;
};

BigInteger.prototype.divRemTo = function(m, q, r) {
    const pm = m.abs();
    if (pm.t <= 0) return;
    const pt = this.abs();
    if (pt.t < pm.t) {
        if (q != null) q.fromInt(0);
        if (r != null) this.copyTo(r);
        return;
    }
    if (r == null) r = new BigInteger();
    const y = new BigInteger();
    const ts = this.s, ms = m.s;
    const nsh = 26 - this.nbits(pm.data[pm.t - 1]);
    if (nsh > 0) { pm.lShiftTo(nsh, y); pt.lShiftTo(nsh, r); } else { pm.copyTo(y); pt.copyTo(r); }
    const ys = y.t;
    const y0 = y.data[ys - 1];
    if (y0 === 0) return;
    const yt = y0 * (1 << 26) + (ys > 1 ? y.data[ys - 2] >> 0 : 0);
    const d1 = 0x8000000 / yt, d2 = (1 << 26) / yt, e = 1 << 0;
    let i = r.t, j = i - ys;
    const t = q == null ? new BigInteger() : q;
    y.dlShiftTo(j, t);
    if (r.compareTo(t) >= 0) {
        r.data[r.t++] = 1;
        r.subTo(t, r);
    }
    BigInteger.ONE.dlShiftTo(ys, t);
    t.subTo(y, y);
    while (y.t < ys) y.data[y.t++] = 0;
    while (--j >= 0) {
        let qd = r.data[--i] === y0 ? 0x3ffffff : Math.floor(r.data[i] * d1 + (r.data[i - 1] + e) * d2);
        if ((r.data[i] += y.am(0, qd, r, j, 0, ys)) < qd) {
            y.dlShiftTo(j, t);
            r.subTo(t, r);
            while (r.data[i] < --qd) r.subTo(t, r);
        }
    }
    if (q != null) {
        r.drShiftTo(ys, q);
        if (ts !== ms) BigInteger.ZERO.subTo(q, q);
    }
    r.t = ys;
    r.clamp();
    if (nsh > 0) r.rShiftTo(nsh, r);
    if (ts < 0) BigInteger.ZERO.subTo(r, r);
};

BigInteger.prototype.invDigit = function() {
    if (this.t < 1) return 0;
    const x = this.data[0];
    if ((x & 1) === 0) return 0;
    let y = x & 3;
    y = (y * (2 - (x & 0xf) * y)) & 0xf;
    y = (y * (2 - (x & 0xff) * y)) & 0xff;
    y = (y * (2 - (((x & 0xffff) * y) & 0xffff))) & 0xffff;
    y = (y * (2 - x * y % 0x4000000)) % 0x4000000;
    return y > 0 ? 0x4000000 - y : -y;
};

BigInteger.prototype.lShiftTo = function(n, r) {
    const bs = n % 26;
    const cbs = 26 - bs;
    const bm = (1 << cbs) - 1;
    const ds = Math.floor(n / 26);
    let c = (this.s << bs) & 0x3ffffff;
    for (let i = this.t - 1; i >= 0; --i) {
        r.data[i + ds + 1] = (this.data[i] >> cbs) | c;
        c = (this.data[i] & bm) << bs;
    }
    for (let i = ds - 1; i >= 0; --i) r.data[i] = 0;
    r.data[ds] = c;
    r.t = this.t + ds + 1;
    r.s = this.s;
    r.clamp();
};

BigInteger.prototype.rShiftTo = function(n, r) {
    r.s = this.s;
    const ds = Math.floor(n / 26);
    if (ds >= this.t) { r.t = 0; return; }
    const bs = n % 26;
    const cbs = 26 - bs;
    const bm = (1 << bs) - 1;
    r.data[0] = this.data[ds] >> bs;
    for (let i = ds + 1; i < this.t; ++i) {
        r.data[i - ds - 1] |= (this.data[i] & bm) << cbs;
        r.data[i - ds] = this.data[i] >> bs;
    }
    if (bs > 0) r.data[this.t - ds - 1] |= (this.s & bm) << cbs;
    r.t = this.t - ds;
    r.clamp();
};

BigInteger.prototype.dlShiftTo = function(n, r) {
    for (let i = this.t - 1; i >= 0; --i) r.data[i + n] = this.data[i];
    for (let i = n - 1; i >= 0; --i) r.data[i] = 0;
    r.t = this.t + n;
    r.s = this.s;
};

BigInteger.prototype.drShiftTo = function(n, r) {
    for (let i = n; i < this.t; ++i) r.data[i - n] = this.data[i];
    r.t = Math.max(this.t - n, 0);
    r.s = this.s;
};

BigInteger.prototype.multiplyTo = function(a, r) {
    const x = this.abs(), y = a.abs();
    let i = x.t;
    r.t = i + y.t;
    while (--i >= 0) r.data[i] = 0;
    for (i = 0; i < y.t; ++i) r.data[i + x.t] = x.am(0, y.data[i], r, i, 0, x.t);
    r.s = 0;
    r.clamp();
    if (this.s !== a.s) BigInteger.ZERO.subTo(r, r);
};

BigInteger.prototype.squareTo = function(r) {
    const x = this.abs();
    let i = r.t = 2 * x.t;
    while (--i >= 0) r.data[i] = 0;
    for (i = 0; i < x.t - 1; ++i) {
        const c = x.am(i, x.data[i], r, 2 * i, 0, 1);
        if ((r.data[i + x.t] += x.am(i + 1, 2 * x.data[i], r, 2 * i + 1, c, x.t - i - 1)) >= 0x4000000) {
            r.data[i + x.t] -= 0x4000000;
            r.data[i + x.t + 1] = 1;
        }
    }
    if (r.t > 0) r.data[r.t - 1] += x.am(i, x.data[i], r, 2 * i, 0, 1);
    r.s = 0;
    r.clamp();
};

BigInteger.prototype.am = function(i, x, w, j, c, n) {
    const xl = x & 0x3fff, xh = x >> 14;
    while (--n >= 0) {
        let l = this.data[i] & 0x3fff;
        const h = this.data[i++] >> 14;
        const m = xh * l + h * xl;
        l = xl * l + ((m & 0x3fff) << 14) + w.data[j] + c;
        c = (l >> 26) + (m >> 14) + xh * h;
        w.data[j++] = l & 0x3ffffff;
    }
    return c;
};

/**
 * RSA公钥类
 */
class RSAPublicKey {
    constructor(modulus, exponent) {
        this.modulus = new BigInteger(modulus, 16);
        this.exponent = new BigInteger(exponent, 16);
    }
}

/**
 * Base64编码/解码
 */
const Base64 = {
    _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

    encode: function(input) {
        let output = "";
        let i = 0;
        while (i < input.length) {
            const chr1 = input[i++];
            const chr2 = i < input.length ? input[i++] : NaN;
            const chr3 = i < input.length ? input[i++] : NaN;
            const enc1 = chr1 >> 2;
            const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            let enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            let enc4 = chr3 & 63;
            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }
            output += this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
                      this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
        }
        return output;
    },

    decode: function(input) {
        const output = [];
        let i = 0;
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        while (i < input.length) {
            const enc1 = this._keyStr.indexOf(input.charAt(i++));
            const enc2 = this._keyStr.indexOf(input.charAt(i++));
            const enc3 = this._keyStr.indexOf(input.charAt(i++));
            const enc4 = this._keyStr.indexOf(input.charAt(i++));
            const chr1 = (enc1 << 2) | (enc2 >> 4);
            const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            const chr3 = ((enc3 & 3) << 6) | enc4;
            output.push(chr1);
            if (enc3 !== 64) output.push(chr2);
            if (enc4 !== 64) output.push(chr3);
        }
        return output;
    }
};

/**
 * Hex编码/解码
 */
const Hex = {
    encode: function(bytes) {
        return bytes.map(b => ('0' + b.toString(16)).slice(-2)).join('');
    },

    decode: function(hex) {
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substr(i, 2), 16));
        }
        return bytes;
    }
};

/**
 * RSA加密工具
 */
const RSA = {
    /**
     * PKCS#1 v1.5 填充
     */
    pkcs1pad2: function(text, keySize) {
        if (keySize < text.length + 11) {
            throw new Error("Message too long for RSA");
        }
        const buffer = [];
        let i = text.length - 1;
        while (i >= 0 && keySize > 0) {
            buffer[--keySize] = text.charCodeAt(i--);
        }
        buffer[--keySize] = 0;
        while (keySize > 2) {
            let x = Math.floor(Math.random() * 254) + 1;
            buffer[--keySize] = x;
        }
        buffer[--keySize] = 2;
        buffer[--keySize] = 0;
        return new BigInteger(buffer);
    },

    /**
     * 解析PEM格式公钥
     */
    getPublicKey: function(pemString) {
        // 去除PEM头尾
        let key = pemString.replace("-----BEGIN PUBLIC KEY-----", "");
        key = key.replace("-----END PUBLIC KEY-----", "");
        key = key.replace(/\s/g, "");

        // Base64解码
        const bytes = Base64.decode(key);

        // 简化的ASN.1解析 - 直接提取modulus和exponent
        // 对于标准的1024位RSA公钥，modulus从字节29开始，长度128字节
        // exponent通常是65537 (0x010001)
        const modulusStart = 29;
        const modulusLength = 128;
        const modulusBytes = bytes.slice(modulusStart, modulusStart + modulusLength);
        const modulusHex = Hex.encode(modulusBytes);

        // exponent是65537，十六进制为010001
        const exponentHex = "010001";

        return new RSAPublicKey(modulusHex, exponentHex);
    },

    /**
     * RSA加密
     */
    encrypt: function(text, publicKey) {
        const keySize = (publicKey.modulus.bitLength() + 7) >> 3;
        const padded = this.pkcs1pad2(text, keySize);
        const encrypted = padded.modPowInt(publicKey.exponent, publicKey.modulus);
        let hex = encrypted.toString(16);

        // 补零到固定长度
        while (hex.length < keySize * 2) {
            hex = "0" + hex;
        }

        // 转为Base64
        const bytes = Hex.decode(hex);
        return Base64.encode(bytes);
    }
};

// ============================================
// 第二部分：SM4加密实现（复用第一步的代码）
// ============================================

/**
 * SM4加密算法（国密算法）
 * 从MOOC登录JS源码中提取和简化
 */

// SM4 S盒
const SM4_SBOX = [
    0xd6, 0x90, 0xe9, 0xfe, 0xcc, 0xe1, 0x3d, 0xb7, 0x16, 0xb6, 0x14, 0xc2, 0x28, 0xfb, 0x2c, 0x05,
    0x2b, 0x67, 0x9a, 0x76, 0x2a, 0xbe, 0x04, 0xc3, 0xaa, 0x44, 0x13, 0x26, 0x49, 0x86, 0x06, 0x99,
    0x9c, 0x42, 0x50, 0xf4, 0x91, 0xef, 0x98, 0x7a, 0x33, 0x54, 0x0b, 0x43, 0xed, 0xcf, 0xac, 0x62,
    0xe4, 0xb3, 0x1c, 0xa9, 0xc9, 0x08, 0xe8, 0x95, 0x80, 0xdf, 0x94, 0xfa, 0x75, 0x8f, 0x3f, 0xa6,
    0x47, 0x07, 0xa7, 0xfc, 0xf3, 0x73, 0x17, 0xba, 0x83, 0x59, 0x3c, 0x19, 0xe6, 0x85, 0x4f, 0xa8,
    0x68, 0x6b, 0x81, 0xb2, 0x71, 0x64, 0xda, 0x8b, 0xf8, 0xeb, 0x0f, 0x4b, 0x70, 0x56, 0x9d, 0x35,
    0x1e, 0x24, 0x0e, 0x5e, 0x63, 0x58, 0xd1, 0xa2, 0x25, 0x22, 0x7c, 0x3b, 0x01, 0x21, 0x78, 0x87,
    0xd4, 0x00, 0x46, 0x57, 0x9f, 0xd3, 0x27, 0x52, 0x4c, 0x36, 0x02, 0xe7, 0xa0, 0xc4, 0xc8, 0x9e,
    0xea, 0xbf, 0x8a, 0xd2, 0x40, 0xc7, 0x38, 0xb5, 0xa3, 0xf7, 0xf2, 0xce, 0xf9, 0x61, 0x15, 0xa1,
    0xe0, 0xae, 0x5d, 0xa4, 0x9b, 0x34, 0x1a, 0x55, 0xad, 0x93, 0x32, 0x30, 0xf5, 0x8c, 0xb1, 0xe3,
    0x1d, 0xf6, 0xe2, 0x2e, 0x82, 0x66, 0xca, 0x60, 0xc0, 0x29, 0x23, 0xab, 0x0d, 0x53, 0x4e, 0x6f,
    0xd5, 0xdb, 0x37, 0x45, 0xde, 0xfd, 0x8e, 0x2f, 0x03, 0xff, 0x6a, 0x72, 0x6d, 0x6c, 0x5b, 0x51,
    0x8d, 0x1b, 0xaf, 0x92, 0xbb, 0xdd, 0xbc, 0x7f, 0x11, 0xd9, 0x5c, 0x41, 0x1f, 0x10, 0x5a, 0xd8,
    0x0a, 0xc1, 0x31, 0x88, 0xa5, 0xcd, 0x7b, 0xbd, 0x2d, 0x74, 0xd0, 0x12, 0xb8, 0xe5, 0xb4, 0xb0,
    0x89, 0x69, 0x97, 0x4a, 0x0c, 0x96, 0x77, 0x7e, 0x65, 0xb9, 0xf1, 0x09, 0xc5, 0x6e, 0xc6, 0x84,
    0x18, 0xf0, 0x7d, 0xec, 0x3a, 0xdc, 0x4d, 0x20, 0x79, 0xee, 0x5f, 0x3e, 0xd7, 0xcb, 0x39, 0x48
];

// SM4 CK常量
const SM4_CK = [];
for (let i = 0; i < 32; i++) {
    SM4_CK[i] = ((4 * i + 0) << 24) | ((4 * i + 1) << 16) | ((4 * i + 2) << 8) | (4 * i + 3);
}

/**
 * SM4核心变换函数
 */
function sm4Sbox(inch) {
    return (SM4_SBOX[(inch >> 24) & 0xFF] << 24) |
           (SM4_SBOX[(inch >> 16) & 0xFF] << 16) |
           (SM4_SBOX[(inch >> 8) & 0xFF] << 8) |
           SM4_SBOX[inch & 0xFF];
}

function sm4Lt(ka) {
    return ka ^ rotateLeft(ka, 2) ^ rotateLeft(ka, 10) ^ rotateLeft(ka, 18) ^ rotateLeft(ka, 24);
}

function sm4F(x0, x1, x2, x3, rk) {
    return x0 ^ sm4Lt(sm4Sbox(x1 ^ x2 ^ x3 ^ rk));
}

function rotateLeft(x, n) {
    return ((x << n) | (x >>> (32 - n))) >>> 0;
}

/**
 * SM4密钥扩展
 */
function sm4KeyExt(key) {
    const MK = [];
    const K = [];
    const rk = [];

    // 将密钥转换为4个32位字
    for (let i = 0; i < 4; i++) {
        MK[i] = ((key[i * 4] & 0xFF) << 24) |
                ((key[i * 4 + 1] & 0xFF) << 16) |
                ((key[i * 4 + 2] & 0xFF) << 8) |
                (key[i * 4 + 3] & 0xFF);
    }

    // FK常量
    const FK = [0xA3B1BAC6, 0x56AA3350, 0x677D9197, 0xB27022DC];

    // 初始化K
    K[0] = MK[0] ^ FK[0];
    K[1] = MK[1] ^ FK[1];
    K[2] = MK[2] ^ FK[2];
    K[3] = MK[3] ^ FK[3];

    // 生成32个轮密钥
    for (let i = 0; i < 32; i++) {
        K[i + 4] = K[i] ^ sm4CalciRK(K[i + 1] ^ K[i + 2] ^ K[i + 3] ^ SM4_CK[i]);
        rk[i] = K[i + 4];
    }

    return rk;
}

function sm4CalciRK(ka) {
    return ka ^ rotateLeft(ka, 13) ^ rotateLeft(ka, 23);
}

/**
 * SM4加密单个块（128位）
 */
function sm4EncryptBlock(input, rk) {
    const x = [];

    // 将输入转换为4个32位字
    for (let i = 0; i < 4; i++) {
        x[i] = ((input[i * 4] & 0xFF) << 24) |
               ((input[i * 4 + 1] & 0xFF) << 16) |
               ((input[i * 4 + 2] & 0xFF) << 8) |
               (input[i * 4 + 3] & 0xFF);
    }

    // 32轮迭代
    for (let i = 0; i < 32; i++) {
        const tmp = sm4F(x[0], x[1], x[2], x[3], rk[i]);
        x[0] = x[1];
        x[1] = x[2];
        x[2] = x[3];
        x[3] = tmp;
    }

    // 反序变换
    const output = [];
    for (let i = 0; i < 4; i++) {
        const val = x[3 - i];
        output[i * 4] = (val >>> 24) & 0xFF;
        output[i * 4 + 1] = (val >>> 16) & 0xFF;
        output[i * 4 + 2] = (val >>> 8) & 0xFF;
        output[i * 4 + 3] = val & 0xFF;
    }

    return output;
}

/**
 * PKCS#5填充
 */
function pkcs5Pad(data) {
    const blockSize = 16;
    const paddingLen = blockSize - (data.length % blockSize);
    const padding = [];
    for (let i = 0; i < paddingLen; i++) {
        padding.push(paddingLen);
    }
    return data.concat(padding);
}

/**
 * UTF-8字符串转字节数组
 */
function utf8ToBytes(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code < 0x80) {
            bytes.push(code);
        } else if (code < 0x800) {
            bytes.push(0xC0 | (code >> 6));
            bytes.push(0x80 | (code & 0x3F));
        } else if (code < 0x10000) {
            bytes.push(0xE0 | (code >> 12));
            bytes.push(0x80 | ((code >> 6) & 0x3F));
            bytes.push(0x80 | (code & 0x3F));
        } else {
            bytes.push(0xF0 | (code >> 18));
            bytes.push(0x80 | ((code >> 12) & 0x3F));
            bytes.push(0x80 | ((code >> 6) & 0x3F));
            bytes.push(0x80 | (code & 0x3F));
        }
    }
    return bytes;
}

/**
 * 十六进制字符串转字节数组
 */
function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

/**
 * 字节数组转十六进制字符串
 */
function bytesToHex(bytes) {
    return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * SM4加密（ECB模式）
 */
function sm4Encrypt(plaintext, keyHex) {
    // 准备密钥
    const keyBytes = hexToBytes(keyHex);
    const rk = sm4KeyExt(keyBytes);

    // 准备明文
    const plaintextBytes = utf8ToBytes(plaintext);
    const paddedBytes = pkcs5Pad(plaintextBytes);

    // 分块加密
    const cipherBytes = [];
    for (let i = 0; i < paddedBytes.length; i += 16) {
        const block = paddedBytes.slice(i, i + 16);
        const encryptedBlock = sm4EncryptBlock(block, rk);
        cipherBytes.push(...encryptedBlock);
    }

    // 返回十六进制字符串
    return bytesToHex(cipherBytes);
}

// ============================================
// 第三部分：MOOC登录第二步主函数
// ============================================

/**
 * MOOC RSA公钥（从源码提取）
 */
const MOOC_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC5gsH+AA4XWONB5TDcUd+xCz7e
jOFHZKlcZDx+pF1i7Gsvi1vjyJoQhRtRSn950x498VUkx7rUxg1/ScBVfrRxQOZ8
xFBye3pjAzfb22+RCuYApSVpJ3OO3KsEuKExftz9oFBv3ejxPlYc5yq7YiBO8XlT
nQN0Sa4R4qhPO3I2MQIDAQAB
-----END PUBLIC KEY-----`;

/**
 * MOOC SM4密钥（从源码提取）
 */
const MOOC_SM4_KEY = "BC60B8B9E4FFEFFA219E5AD77F11F9E2";

/**
 * 生成32位随机rtid
 * Request Tracking ID，用于追踪请求
 */
function generateRtid() {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let rtid = "";
    for (let i = 0; i < 32; i++) {
        rtid += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return rtid;
}

/**
 * 第二步：准备登录参数并加密
 *
 * 完整流程：
 * 1. 使用RSA加密密码
 * 2. 准备13个必填字段的登录参数
 * 3. 将参数转换为JSON字符串
 * 4. 使用SM4加密整个JSON
 *
 * 登录参数包含13个必填字段（按顺序）：
 * 1. un - 邮箱地址
 * 2. pw - RSA加密后的密码（Base64）
 * 3. pd - 产品代码 "imooc"
 * 4. l - 是否记住登录（0/1）
 * 5. d - 记住登录天数（通常10天）
 * 6. t - 当前时间戳（毫秒）
 * 7. pkid - 产品标识 "cjJVGQM"
 * 8. domains - 域名列表（可为空字符串）
 * 9. tk - 第一步获取的ticket
 * 10. pwdKeyUp - 密码输入方式（0=非键盘）
 * 11. channel - 渠道标识（0）
 * 12. topURL - 来源URL
 * 13. rtid - 32位随机追踪ID
 *
 * 可选字段（仅在触发Power验证时添加）：
 * 14. pVParam - Power验证参数对象
 *
 * @param {string} email - 邮箱地址
 * @param {string} password - 明文密码
 * @param {string} ticket - 第一步获取的ticket
 * @param {object} [pVParam] - 可选的Power验证参数（触发验证时需要）
 * @returns {string} SM4加密后的encParams
 */
function prepareLoginParams(email, password, ticket, pVParam = null) {
    console.log("\n========== MOOC登录第二步：密码加密 + 执行登录 ==========\n");

    // 步骤1：使用RSA加密密码
    console.log("步骤1：使用RSA加密密码...");
    const publicKey = RSA.getPublicKey(MOOC_RSA_PUBLIC_KEY);
    const encryptedPassword = RSA.encrypt(password, publicKey);
    console.log("✓ RSA加密完成");
    console.log("  - 明文密码长度:", password.length);
    console.log("  - 加密后长度:", encryptedPassword.length);
    console.log("  - 加密结果（前50字符）:", encryptedPassword.substring(0, 50) + "...");

    // 步骤2：准备登录参数（完整版：13个必填字段 + 可选的pVParam）
    console.log("\n步骤2：准备登录参数...");
    console.log("  ⚠️ 必须包含13个必填字段，顺序与官网一致");

    // 生成32位随机rtid
    const rtid = generateRtid();

    /**
     * 登录参数说明（按官网顺序）：
     *
     * 必填字段（13个）：
     * 1. un - 邮箱地址
     * 2. pw - RSA加密后的密码（Base64格式）
     * 3. pd - 产品代码，固定值 "imooc"
     * 4. l - 是否记住登录，0=否，1=是
     * 5. d - 记住登录的天数，通常为10
     * 6. t - 当前时间戳（毫秒）
     * 7. pkid - 产品标识，固定值 "cjJVGQM"
     * 8. domains - 域名列表，可以为空字符串
     * 9. tk - 第一步获取的ticket
     * 10. pwdKeyUp - 密码是否通过键盘输入，0=否，1=是
     * 11. channel - 渠道标识，固定值 0
     * 12. topURL - 来源URL，固定值 "https://www.icourse163.org/"
     * 13. rtid - 请求追踪ID，32位随机字符串
     *
     * 可选字段（仅在触发Power验证时添加）：
     * 14. pVParam - Power验证参数对象，包含：
     *     - puzzle: Base64编码的VDF难题
     *     - spendTime: 计算耗时（毫秒）
     *     - runTimes: 运算次数
     *     - sid: 验证会话ID
     *     - args: VDF计算结果（JSON字符串）
     *
     * 源码依据：webzj_cdn101_pp_index_dl_*.js 中的 __sendLogin 和 __doLoginReal 函数
     */
    const loginParams = {
        un: email,                              // 1. 邮箱地址
        pw: encryptedPassword,                  // 2. RSA加密后的密码
        pd: "imooc",                            // 3. 产品代码
        l: 0,                                   // 4. 是否记住登录（0=不记住，1=记住）
        d: 10,                                  // 5. 记住登录天数
        t: Date.now(),                          // 6. 当前时间戳（毫秒）
        pkid: "cjJVGQM",                        // 7. 产品标识
        domains: "",                            // 8. 域名列表
        tk: ticket,                             // 9. 第一步获取的ticket
        pwdKeyUp: 0,                            // 10. 密码输入方式（0=非键盘，1=键盘）
        // 14. pVParam - Power验证参数（可选，仅在触发验证时添加，错误码805/806）
        ...(pVParam ? { pVParam } : {}),        // 如果提供了pVParam则添加该字段
        channel: 0,                             // 11. 渠道标识
        topURL: "https://www.icourse163.org/", // 12. 来源URL
        rtid: rtid                              // 13. 请求追踪ID（32位随机字符串）
    };

    const fieldCount = pVParam ? 14 : 13;
    console.log(`✓ 登录参数准备完成（${fieldCount}个字段）`);
    console.log("  1. un (邮箱):", loginParams.un);
    console.log("  2. pw (加密密码，前50字符):", loginParams.pw.substring(0, 50) + "...");
    console.log("  3. pd (产品代码):", loginParams.pd);
    console.log("  4. l (记住登录):", loginParams.l);
    console.log("  5. d (登录天数):", loginParams.d);
    console.log("  6. t (时间戳):", loginParams.t);
    console.log("  7. pkid (产品标识):", loginParams.pkid);
    console.log("  8. domains (域名列表):", loginParams.domains || "(空字符串)");
    console.log("  9. tk (票据):", loginParams.tk);
    console.log("  10. pwdKeyUp (输入方式):", loginParams.pwdKeyUp);
    if (pVParam) {
        console.log("  14. pVParam (Power验证):", {
            sid: loginParams.pVParam.sid,
            spendTime: loginParams.pVParam.spendTime,
            runTimes: loginParams.pVParam.runTimes,
            "puzzle(前50字符)": loginParams.pVParam.puzzle.substring(0, 50) + "...",
            args: loginParams.pVParam.args
        });
        console.log("  ⚠️ 包含Power验证参数，用于处理错误码805/806");
    }
    console.log("  11. channel (渠道):", loginParams.channel);
    console.log("  12. topURL (来源):", loginParams.topURL);
    console.log("  13. rtid (追踪ID):", loginParams.rtid);
    if (!pVParam) {
        console.log("\n  💡 如果登录返回错误码805/806，需要添加第14个字段 pVParam（Power验证参数）");
    }

    // 步骤3：转换为JSON字符串（紧凑格式）
    console.log("\n步骤3：转换为JSON字符串...");
    const jsonString = JSON.stringify(loginParams);
    console.log("✓ JSON转换完成");
    console.log("  - JSON长度:", jsonString.length);
    console.log("  - JSON（前100字符）:", jsonString.substring(0, 100) + "...");

    console.log("真实JSON："+ jsonString)
    // 步骤4：使用SM4加密整个参数
    console.log("\n步骤4：使用SM4加密整个参数...");
    const encParams = sm4Encrypt(jsonString, MOOC_SM4_KEY);
    console.log("✓ SM4加密完成");
    console.log("  - 加密后长度:", encParams.length);
    console.log("  - 加密结果（前100字符）:", encParams.substring(0, 100) + "...");

    console.log("\n========== 加密完成 ==========\n");

    return encParams;
}

/**
 * 生成完整的POST请求信息
 */
function generateLoginRequest(encParams) {
    console.log("========== POST请求信息 ==========\n");
    console.log("URL: POST https://reg.icourse163.org/dl/zj/mail/l");
    console.log("\nHeaders:");
    console.log("  Content-Type: application/json");
    console.log("  User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36");
    console.log("  Referer: https://www.icourse163.org/");
    console.log("  Origin: https://www.icourse163.org");
    console.log("\nBody:");
    const body = { encParams: encParams };
    console.log(JSON.stringify(body, null, 2));
    console.log("\n========== 请求信息结束 ==========\n");

    return body;
}

// ============================================
// 第四部分：测试和使用示例
// ============================================

/**
 * 测试函数
 */
function test() {
    console.log("=".repeat(70));
    console.log("MOOC登录第二步工具 - 测试模式");
    console.log("=".repeat(70));

    // 测试数据
    const testEmail = "test@163.com";
    const testPassword = "123456";
    const testTicket = "1472a505ffded57f707d55e6316d38c4";  // 从第一步获取的ticket

    console.log("\n测试参数:");
    console.log("  - 邮箱:", testEmail);
    console.log("  - 密码:", "*".repeat(testPassword.length));
    console.log("  - 票据:", testTicket);

    const pVParam = {
        "puzzle": "woVmIfMmB3qI6a7ywfvS+/7oyCpQ0cGCf+o2wYqut+j3l7AIUwOleuqfAK81I3LLJNLIBACGRBZc\r\ng4Ed845dXvUYeXFHF6jNo+MIGQrQkvyrLCHlSANnDPDax5/KM37Oh522JPn3jyzrb6JCzXdxYFKf\r\nvXOh+bYorRyRvrlKzFWNmlpN+cRj0MO+innrNn1IX8RQT0qF0trc6PJA84zJDEbEzwQu6BgP3bWL\r\ngK4mb/FbvUKM/YzGaFOM1LUeplXjAMSKIEbAI8X4TPJ325u4hw==",
        "spendTime": 1051,
        "runTimes": 138509,
        "sid": "5f42667c-407d-4a16-8a94-25b45123bc60",
        "args": "{\"x\":\"5595fb5a7676c62152c050af291b531b20\",\"t\":138509,\"sign\":2553298163}"
    }




    // 执行加密
    const encParams = prepareLoginParams(testEmail, testPassword, testTicket,pVParam);

    // 生成请求信息
    const requestBody = generateLoginRequest(encParams);

    console.log("\n完整的encParams:");
    console.log(encParams);

    console.log("\n========== 使用说明 ==========");
    console.log("1. 复制上面的 encParams 值");
    console.log("2. 在接口工具（Postman/Apifox）中创建POST请求");
    console.log("3. URL: https://reg.icourse163.org/dl/zj/mail/l");
    console.log("4. Headers: Content-Type: application/json");
    console.log("5. Body: {\"encParams\": \"粘贴encParams值\"}");
    console.log("6. 发送请求");
    console.log("\n成功响应示例:");
    console.log("{");
    console.log("  \"ret\": 200,");
    console.log("  \"nextUrls\": [\"url1\", \"url2\", ...]");
    console.log("}");
    console.log("\n触发Power验证的响应示例:");
    console.log("{");
    console.log("  \"ret\": 805,  // 或 806");
    console.log("  \"pVInfo\": {");
    console.log("    \"sid\": \"ca28cfe2-b96d-4499-898b-028c481bd3e2\",");
    console.log("    \"puzzle\": \"Base64编码的VDF难题...\",");
    console.log("    \"needCheck\": true");
    console.log("  }");
    console.log("}");
    console.log("\n如果收到上述响应，需要：");
    console.log("1. 调用 Power验证接口获取 pVParam");
    console.log("2. 重新调用本工具，传入 pVParam 参数");
    console.log("3. 使用新生成的 encParams 再次登录");
    console.log("=".repeat(70));
}

/**
 * 命令行模式
 */
function main() {
    const args = ""

    if (args.length === 0) {
        // 测试模式
        test();
    } else if (args.length === 3) {
        // 实际使用模式
        const [email, password, ticket] = args;
        const encParams = prepareLoginParams(email, password, ticket);
        generateLoginRequest(encParams);
        console.log("\nencParams:");
        console.log(encParams);
    } else {
        console.log("用法:");
        console.log("  测试模式: node login-step2-tool.js");
        console.log("  实际使用: node login-step2-tool.js <email> <password> <ticket>");
        console.log("\n示例:");
        console.log("  node login-step2-tool.js test@163.com mypassword ABC123XYZ");
    }
}

// 运行
if (require.main === module) {
    main();
}

// 导出函数供其他模块使用
module.exports = {
    prepareLoginParams,
    generateLoginRequest,
    RSA,
    sm4Encrypt,
    MOOC_RSA_PUBLIC_KEY,
    MOOC_SM4_KEY
};

/**
 * =====================================================================
 * Power验证（VDF）的 args 计算方法说明
 * =====================================================================
 *
 * 当登录返回错误码 805/806 时，需要进行 VDF (Verifiable Delay Function) 验证。
 * pVParam.args 的计算方式如下（从源码提取）：
 *
 * 函数签名：
 * function vdfCb(startTime, runTimes, result, puzzle, config, callback)
 *
 * 计算步骤：
 * 1. 准备参数对象：
 *    {
 *      runTimes: 运算次数（t）,
 *      spendTime: 耗时（毫秒）,
 *      t: 运算次数（与runTimes相同）,
 *      x: result.toString(16)  // BigNumber转16进制字符串
 *    }
 *
 * 2. 按固定顺序构建查询字符串：
 *    字段顺序：["runTimes", "spendTime", "t", "x"]
 *    格式：encodeURIComponent(key) + "=" + encodeURIComponent(value)
 *    示例：runTimes=774471&spendTime=3051&t=774471&x=7681fc3a63e59c101e0b0a7b8f50c8e2d4
 *
 * 3. 使用 MurmurHash3 (powSign函数) 计算签名：
 *    sign = powSign(queryString, runTimes)
 *    // powSign是一个哈希函数，使用runTimes作为种子
 *
 * 4. 生成最终的 args JSON字符串：
 *    {
 *      "x": "7681fc3a63e59c101e0b0a7b8f50c8e2d4",  // 16进制字符串
 *      "t": 774471,                                  // 运算次数
 *      "sign": 3871685038                            // MurmurHash3签名（32位无符号整数）
 *    }
 *
 * VDF计算过程（vdfSync函数）：
 * 1. 从powGetP接口获取参数：
 *    - puzzle: Base64编码的难题
 *    - mod: 模数（16进制）
 *    - x: 初始值（16进制）
 *    - t: 迭代次数
 *
 * 2. 执行VDF计算（模平方运算）：
 *    result = x^(2^t) mod m
 *    // 实际是循环 t 次：result = result * result mod m
 *
 * 3. 计算过程监控：
 *    - 每2000次迭代检查一次超时
 *    - maxTime: 最大允许时间（从powGetP返回）
 *    - minTime: 最小执行时间（确保计算时间）
 *
 * 源码依据：webzj_cdn101_pp_index_reg_*.js 中的函数
 * - vdfCb: 生成args的回调函数
 * - powSign: MurmurHash3签名算法
 * - vdfSync: VDF同步计算函数
 * - vdfFun: VDF计算入口
 *
 * MurmurHash3 (powSign) 算法伪代码：
 * ```javascript
 * function powSign(str, seed) {
 *     // 使用 MurmurHash3 32位算法
 *     // 种子：seed (运算次数 runTimes)
 *     // 输入：查询字符串
 *     // 输出：32位无符号整数
 * }
 * ```
 *
 * 完整示例（实际登录时的数据）：
 * ```json
 * {
 *   "pVParam": {
 *     "puzzle": "MNebU1x0vJh87i1iDkimfV7WgWNZnEZnM/iKUe7cFUl7g7d2BQBE8xgWZqaGxbuTYvNwkc7O82t0...",
 *     "spendTime": 3051,
 *     "runTimes": 774471,
 *     "sid": "ca28cfe2-b96d-4499-898b-028c481bd3e2",
 *     "args": "{\"x\":\"7681fc3a63e59c101e0b0a7b8f50c8e2d4\",\"t\":774471,\"sign\":3871685038}"
 *   }
 * }
 * ```
 *
 * 注意事项：
 * 1. VDF计算需要大整数运算库（如BigNumber.js）
 * 2. 计算时间通常需要几秒到几十秒
 * 3. args中的sign是必需的，用于验证计算结果的正确性
 * 4. 字段顺序很重要，必须按 runTimes, spendTime, t, x 的顺序构建查询字符串
 * 5. x 必须是小写的16进制字符串（不能有0x前缀）
 * 6. sign 是无符号32位整数
 * =====================================================================
 */

