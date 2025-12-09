/**
 * MOOC Power验证（VDF）完整工具 - 从源码提取
 *
 * 功能：完整实现 pVParam 计算，包括真实的 VDF 大整数运算
 *
 * 作者：ShiYi
 * 日期：2024-12-08
 * 源码：webzj_cdn101_pp_index_*_*.js
 */

// ===== BigNumber.js 库（使用 npm 安装的版本）=====
const BigNumber = require('bignumber.js');

/**
 * powSign - MurmurHash3签名算法（从源码提取）
 */
function powSign(key, seed) {
    var remainder, bytes, h1, h1b, c1, c1b, c2, c2b, k1, i;

    remainder = key.length & 3;
    bytes = key.length - remainder;
    h1 = seed;
    c1 = 0xcc9e2d51;
    c2 = 0x1b873593;
    i = 0;

    while (i < bytes) {
        k1 =
            (key.charCodeAt(i) & 0xff) |
            ((key.charCodeAt(++i) & 0xff) << 8) |
            ((key.charCodeAt(++i) & 0xff) << 16) |
            ((key.charCodeAt(++i) & 0xff) << 24);
        ++i;

        k1 =
            ((k1 & 0xffff) * c1 + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 =
            ((k1 & 0xffff) * c2 + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;

        h1 ^= k1;
        h1 = (h1 << 13) | (h1 >>> 19);
        h1b =
            ((h1 & 0xffff) * 5 + ((((h1 >>> 16) * 5) & 0xffff) << 16)) & 0xffffffff;
        h1 = (h1b & 0xffff) + 0x6b64 + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16);
    }

    k1 = 0;
    switch (remainder) {
        case 3:
            k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
        case 2:
            k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
        case 1:
            k1 ^= key.charCodeAt(i) & 0xff;
            k1 =
                ((k1 & 0xffff) * c1 + ((((k1 >>> 16) * c1) & 0xffff) << 16)) &
                0xffffffff;
            k1 = (k1 << 15) | (k1 >>> 17);
            k1 =
                ((k1 & 0xffff) * c2 + ((((k1 >>> 16) * c2) & 0xffff) << 16)) &
                0xffffffff;
            h1 ^= k1;
    }

    h1 ^= key.length;
    h1 ^= h1 >>> 16;
    h1 =
        ((h1 & 0xffff) * 0x85ebca6b +
            ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) &
        0xffffffff;
    h1 ^= h1 >>> 13;
    h1 =
        ((h1 & 0xffff) * 0xc2b2ae35 +
            ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16)) &
        0xffffffff;
    h1 ^= h1 >>> 16;

    return h1 >>> 0;
}

/**
 * vdfCb - VDF计算完成回调（从源码提取）
 */
function vdfCb(startTime, count, bigx, puzzle, data, cb) {
    var time = (new Date()).getTime() - startTime;
    var signObj = {
        runTimes: count,
        spendTime: time,
        t: count,
        x: bigx.toString(16)
    };
    var sortedParams = ["runTimes", "spendTime", "t", "x"];
    var encodedParams = [];
    for (var j = 0; j < sortedParams.length; j++) {
        var key = sortedParams[j];
        var value = signObj[key];
        encodedParams.push(
            encodeURIComponent(key) + "=" + encodeURIComponent(value)
        );
    }
    encodedParams = encodedParams.join("&");
    var sign = powSign(encodedParams, count);
    return cb({
        maxTime: data.maxTime,
        puzzle: puzzle,
        spendTime: time,
        runTimes: count,
        sid: data.sid,
        args: JSON.stringify({
            x: bigx.toString(16),
            t: count,
            sign: sign
        })
    });
}

/**
 * vdfSync - 同步VDF计算（从源码提取）
 */
function vdfSync(data, cb) {
    var puzzle = data.args.puzzle;
    var mod = data.args.mod;
    var x = data.args.x;
    var t = data.args.t;
    var startTime = (new Date()).getTime();
    var bigx = new BigNumber(x, 16);
    var bigmod = new BigNumber(mod, 16);
    var count = 0;
    var jobcount = 2000;
    var tnum = parseInt(t, 10);
    var jobs = Math.ceil(tnum / jobcount);
    var joblist = [];
    for (var b = 0; b < jobs; b++) {
        if (b === jobs - 1) {
            joblist.push(tnum - b * jobcount);
        } else {
            joblist.push(jobcount);
        }
    }
    var ji = -1;
    var stl = setInterval(function() {
        if ((++ji) < joblist.length) {
            var jobt = joblist[ji];
            for (var i = 0; i < jobt || (new Date()).getTime() - startTime < data.minTime; i++) {
                bigx = bigx.multipliedBy(bigx).mod(bigmod);
                count++;
                var nowTime = (new Date()).getTime();
                if (nowTime - startTime > data.maxTime) {
                    clearInterval(stl);
                    vdfCb(startTime, count, bigx, puzzle, data, cb);
                    break;
                }
            }
        } else {
            clearInterval(stl);
            vdfCb(startTime, count, bigx, puzzle, data, cb);
        }
    }, 50);
}

/**
 * 执行 Power 验证计算（从源码提取的完整流程）
 *
 * @param {object} powerData - 从 powGetP 接口获取的数据
 * @param {function} callback - 计算完成后的回调函数
 */
function calculatePowerVerification(powerData, callback) {
    console.log("\n========== 开始 Power 验证计算 ==========");
    console.log("输入数据:");
    console.log(JSON.stringify(powerData, null, 2));

    vdfSync(powerData, callback);
}

/**
 * 测试函数：使用真实的 API 响应数据
 */
function testWithRealCalculation() {
    console.log("=".repeat(70));
    console.log("Power 验证完整计算测试 - 使用真实 API 数据");
    console.log("=".repeat(70));

    // 真实的 powGetP 接口返回数据
    const apiResponse = {
        "ret": "201",
        "pVInfo": {
            "needCheck": true,
            "sid": "5f42667c-407d-4a16-8a94-25b45123bc60",
            "hashFunc": "VDF_FUNCTION",
            "maxTime": 1050,
            "minTime": 1000,
            "args": {
                "mod": "8ea24bb0bc226a6dbcfec5049ba24e2363",
                "t": 200000,
                "puzzle": "woVmIfMmB3qI6a7ywfvS+/7oyCpQ0cGCf+o2wYqut+j3l7AIUwOleuqfAK81I3LLJNLIBACGRBZc\r\ng4Ed845dXvUYeXFHF6jNo+MIGQrQkvyrLCHlSANnDPDax5/KM37Oh522JPn3jyzrb6JCzXdxYFKf\r\nvXOh+bYorRyRvrlKzFWNmlpN+cRj0MO+innrNn1IX8RQT0qF0trc6PJA84zJDEbEzwQu6BgP3bWL\r\ngK4mb/FbvUKM/YzGaFOM1LUeplXjAMSKIEbAI8X4TPJ325u4hw==",
                "x": "816ddd727f"
            }
        }
    }

    console.log("\n使用真实 API 返回的数据:");
    console.log("  sid:", apiResponse.pVInfo.sid);
    console.log("  maxTime:", apiResponse.pVInfo.maxTime, "ms");
    console.log("  minTime:", apiResponse.pVInfo.minTime, "ms");
    console.log("  t (迭代次数):", apiResponse.pVInfo.args.t);
    console.log("  mod:", apiResponse.pVInfo.args.mod);
    console.log("  x:", apiResponse.pVInfo.args.x);
    console.log("\n注意：计算 200000 次迭代可能需要几秒到几十秒\n");

    const powerData = {
        maxTime: apiResponse.pVInfo.maxTime,
        minTime: apiResponse.pVInfo.minTime,
        sid: apiResponse.pVInfo.sid,
        args: {
            puzzle: apiResponse.pVInfo.args.puzzle,
            mod: apiResponse.pVInfo.args.mod,
            x: apiResponse.pVInfo.args.x,
            t: apiResponse.pVInfo.args.t
        }
    };

    calculatePowerVerification(powerData, function(result) {
        console.log("\n========== 计算完成 ==========");
        console.log("结果:");
        console.log(JSON.stringify(result, null, 2));

        // 解析 args 字符串
        const args = JSON.parse(result.args);
        console.log("\nargs 详情:");
        console.log("  x (16进制):", args.x);
        console.log("  t (运算次数):", args.t);
        console.log("  sign (签名):", args.sign);

        console.log("\n完整的 pVParam 参数（用于登录请求）:");
        console.log(JSON.stringify({
            puzzle: result.puzzle,
            spendTime: result.spendTime,
            runTimes: result.runTimes,
            sid: result.sid,
            args: result.args
        }, null, 2));

        console.log("\n提示：将上述 pVParam 对象添加到登录请求的 JSON 参数中");
        console.log("=".repeat(70));

        // 退出程序
        process.exit(0);
    });
}

/**
 * 主函数
 */
function main() {
    // 验证官网示例的签名计算
    console.log("=".repeat(70));
    console.log("验证 powSign 函数");
    console.log("=".repeat(70));

    const testQuery = "runTimes=774471&spendTime=3051&t=774471&x=7681fc3a63e59c101e0b0a7b8f50c8e2d4";
    const testSeed = 774471;
    const calculatedSign = powSign(testQuery, testSeed);
    const expectedSign = 3871685038;

    console.log("查询字符串:", testQuery);
    console.log("种子 (runTimes):", testSeed);
    console.log("计算的签名:", calculatedSign);
    console.log("期望的签名:", expectedSign);
    console.log("签名匹配:", calculatedSign === expectedSign ? "✓ 正确!" : "✗ 错误");
    console.log("=".repeat(70));

    // 运行完整的 VDF 计算测试
    // 注意：这会执行真实的大整数运算，可能需要一些时间
    console.log("\n即将开始真实的 VDF 计算（200000次迭代）...\n");
    testWithRealCalculation();
}

// 运行测试
if (require.main === module) {
    main();
}

// 导出函数
module.exports = {
    powSign,
    vdfCb,
    vdfSync,
    calculatePowerVerification
};

/**
 * =====================================================================
 * 使用说明
 * =====================================================================
 *
 * 这是从 MOOC 网站源码完整提取的 Power 验证计算工具
 *
 * 1. 包含的功能：
 *    - BigNumber.js: 大整数运算库（从源码提取）
 *    - powSign: MurmurHash3 签名算法
 *    - vdfCb: VDF 计算完成回调
 *    - vdfSync: 同步 VDF 计算（使用真实的模平方运算）
 *
 * 2. 使用流程：
 *    a. 登录失败，返回错误码 805/806
 *    b. 调用 powGetP 接口，获取 VDF 参数（包含 mod, x, t）
 *    c. 调用 calculatePowerVerification(powerData, callback)
 *    d. 在回调中获取计算结果（pVParam）
 *    e. 将 pVParam 添加到登录参数中
 *    f. 重新发送登录请求
 *
 * 3. VDF 计算原理：
 *    - 算法：模平方运算 result = x^(2^t) mod m
 *    - 实现：循环 t 次执行 result = result * result mod m
 *    - 每 2000 次迭代暂停 50ms，避免阻塞
 *    - 实时检查超时（maxTime）和最小时间（minTime）
 *
 * 4. 注意事项：
 *    - 这是完全从源码提取的真实实现
 *    - VDF 计算需要时间，通常几秒到几十秒
 *    - 所有算法与 MOOC 官网完全一致
 * =====================================================================
 */

