/******************************
 * Quantumult X 众安健康
 *
 * 功能：
 * 1. 自动提取 Access-Token / Cookie
 * 2. 本地持久化保存账号
 * 3. 多账号签到
 * 4. 浏览任务
 * 5. 领取奖励
 * 6. 查询累计金额 / 可提现金额
 *
 * 存储 Key：
 * zajk_accounts_v1

[rewrite_local]
^https:\/\/ihealth\.zhongan\.com\/api\/lemon\/v1\/(?:wechatApplet\/obtainBaseInfo|common\/activity\/homePage|common\/activity\/signIn|applet\/mgm\/activity\/add\/award|common\/activity\/lottery|common\/activity\/withdraw) url script-request-header https://raw.githubusercontent.com/你的仓库/ZAJK.js

[task_local]
30 8,20 * * * https://raw.githubusercontent.com/你的仓库/ZAJK.js, tag=众安健康签到, enabled=true

[mitm]
hostname = ihealth.zhongan.com

 ******************************/

const SCRIPT_NAME = "🏢 众安健康";
const STORE_KEY = "zajk_accounts_v1";

/**
 * ==============================
 * 功能开关
 * ==============================
 */
const CONFIG = {
  // 是否推送任务通知
  NOTIFY: true,

  // 是否推送账号提取通知
  CAPTURE_NOTIFY: true,

  // 账号提取通知间隔，避免频繁通知
  CAPTURE_NOTIFY_INTERVAL: 10 * 60 * 1000,

  // 是否开启调试日志
  DEBUG: false,

  // 是否执行浏览任务
  DO_BROWSE_TASK: true,

  // 是否领取奖励
  DO_CLAIM_REWARD: true,

  // 随机等待，单位毫秒
  DELAY_MIN: 2500,
  DELAY_MAX: 4500,

  ACTIVITY_CODE: "ONA20220411001",
  CHANNEL_CODE: "c20195660470001",

  HOST: "ihealth.zhongan.com",

  USER_AGENT:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.23(0x1800172f) NetType/WIFI Language/zh_CN",

  REFERER:
    "https://servicewechat.com/wxbac45cc1588a5a75/210/page-frame.html"
};

/**
 * ==============================
 * 接口地址
 * ==============================
 */
const API = {
  BASE_INFO:
    "https://ihealth.zhongan.com/api/lemon/v1/wechatApplet/obtainBaseInfo/c20195660470001",

  HOME_PAGE:
    "https://ihealth.zhongan.com/api/lemon/v1/common/activity/homePage",

  SIGN_IN:
    "https://ihealth.zhongan.com/api/lemon/v1/common/activity/signIn",

  BROWSE_REWARD:
    "https://ihealth.zhongan.com/api/lemon/v1/applet/mgm/activity/add/award",

  LOTTERY:
    "https://ihealth.zhongan.com/api/lemon/v1/common/activity/lottery"
};

/**
 * ==============================
 * 运行环境判断
 * ==============================
 *
 * rewrite 触发：提取账号
 * task 触发：执行任务
 */
if (typeof $request !== "undefined" && $request.headers) {
  handleCapture();
} else {
  runTask();
}

/**
 * ==============================
 * Rewrite 触发：自动提取账号
 * ==============================
 */
function handleCapture() {
  try {
    captureZAJKAccount();
  } catch (e) {
    console.log(`【${SCRIPT_NAME}】账号提取异常：${e.message}`);
    if (CONFIG.CAPTURE_NOTIFY) {
      $notify(SCRIPT_NAME, "❌ 账号提取异常", String(e.message || e));
    }
  } finally {
    $done({ headers: $request.headers });
  }
}

function captureZAJKAccount() {
  const headers = $request.headers || {};

  const token =
    getHeader(headers, "Access-Token") ||
    getHeader(headers, "access-token") ||
    "";

  const cookie =
    getHeader(headers, "Cookie") ||
    getHeader(headers, "cookie") ||
    "";

  if (!token) {
    console.log(`【${SCRIPT_NAME}】未发现 Access-Token，跳过保存`);
    return;
  }

  const store = loadAccountStore();
  const now = Date.now();

  const id = findAccountId(store, token, cookie) || makeAccountId(token, cookie);
  const old = store.accounts[id] || {};

  const isNew = !store.accounts[id];
  const tokenChanged = old.token && old.token !== token;
  const cookieChanged = cookie && old.cookie !== cookie;

  store.accounts[id] = {
    id,
    alias: old.alias || `众安健康-${id.slice(0, 6)}`,
    token,
    cookie: cookie || old.cookie || "",
    phone: old.phone || "",
    createdAt: old.createdAt || now,
    updatedAt: now,
    lastCaptureUrl: $request.url || "",
    lastNotifiedAt: old.lastNotifiedAt || 0
  };

  if (!Array.isArray(store.order)) {
    store.order = [];
  }

  if (!store.order.includes(id)) {
    store.order.push(id);
  }

  store.order = store.order.filter(x => store.accounts[x]);
  store.updatedAt = now;

  const shouldNotify =
    CONFIG.CAPTURE_NOTIFY &&
    (
      isNew ||
      tokenChanged ||
      cookieChanged ||
      now - Number(old.lastNotifiedAt || 0) > CONFIG.CAPTURE_NOTIFY_INTERVAL
    );

  if (shouldNotify) {
    store.accounts[id].lastNotifiedAt = now;
  }

  saveAccountStore(store);

  const total = store.order.filter(x => store.accounts[x]).length;

  const msg =
    `账号 ID：${id}\n` +
    `Token：${maskText(token)}\n` +
    `Cookie：${cookie ? "已获取" : old.cookie ? "沿用旧 Cookie" : "未获取"}\n` +
    `当前共 ${total} 个账号`;

  console.log(`【${SCRIPT_NAME}】账号已保存\n${msg}`);

  if (shouldNotify) {
    $notify(
      SCRIPT_NAME,
      isNew ? "✅ 新账号已保存" : "✅ 账号信息已更新",
      msg
    );
  }
}

/**
 * ==============================
 * Task 触发：主任务入口
 * ==============================
 */
async function runTask() {
  const notifyList = [];

  try {
    const accounts = loadAccountsFromStore();

    if (accounts.length === 0) {
      const msg =
        "❌ 暂无账号数据\n\n" +
        "请先开启重写和 MitM，然后打开众安健康小程序页面，让 QX 自动提取 Access-Token。";

      console.log(msg);
      notify(SCRIPT_NAME, "配置缺失", msg);
      return;
    }

    console.log(`👥 共找到 ${accounts.length} 个账号`);

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];

      console.log("\n━━━━━━━━━━━━━━━━━━━━");
      console.log(`🔹 开始第 ${i + 1} 个账号`);
      console.log(`🆔 账号 ID：${account.id || "未知"}`);
      console.log("━━━━━━━━━━━━━━━━━━━━");

      try {
        const result = await runAccount(account, i + 1);
        notifyList.push(result.notifyMsg);
      } catch (e) {
        const errMsg =
          `👤 账号 ${i + 1}\n` +
          `❌ 执行失败：${e.message}`;

        console.log(errMsg);
        notifyList.push(errMsg);
      }

      if (i < accounts.length - 1) {
        await randomDelay();
      }
    }

    if (CONFIG.NOTIFY && notifyList.length > 0) {
      notify(
        SCRIPT_NAME,
        `${accounts.length} 个账号执行完成`,
        notifyList.join("\n\n━━━━━━━━━━━━\n\n")
      );
    }
  } catch (e) {
    const msg = `❌ 脚本异常：${e.message}`;
    console.log(msg);
    notify(SCRIPT_NAME, "脚本异常", msg);
  } finally {
    $done();
  }
}

/**
 * ==============================
 * 单账号任务
 * ==============================
 */
async function runAccount(account, index) {
  const { id, token, cookie } = account;

  const userInfo = {
    nickName: account.alias || "未知",
    phone: account.phone || "未获取到"
  };

  const summary = {
    sign: "未执行",
    browse: [],
    rewards: [],
    sumAward: "0.00元",
    sumAllowWithdraw: "0.00元"
  };

  const baseHeaders = buildBaseHeaders(token, cookie);

  /**
   * 1. 获取用户基础信息
   */
  console.log("🔄 正在获取账户信息...");
  const baseInfo = await postJson(API.BASE_INFO, baseHeaders, {});

  if (baseInfo?.code === "0" && baseInfo?.result) {
    userInfo.nickName = baseInfo.result.nickName || userInfo.nickName || "未知";
    userInfo.phone = baseInfo.result.phone
      ? maskPhone(baseInfo.result.phone)
      : userInfo.phone || "未获取到";

    console.log(`👤 账户：${userInfo.nickName}`);
    console.log(`📱 手机号：${userInfo.phone}`);

    if (id) {
      updateStoredAccountMeta(id, {
        alias: userInfo.nickName,
        phone: userInfo.phone
      });
    }
  } else {
    console.log(`⚠️ 获取账户信息失败：${baseInfo?.message || "未知错误"}`);
  }

  await randomDelay();

  /**
   * 2. 获取首页数据
   */
  console.log("🔄 正在获取活动首页...");
  const homeData = await getHomePage(baseHeaders);

  if (homeData?.code !== "0") {
    throw new Error(homeData?.message || "获取活动首页失败，账号可能失效");
  }

  console.log("✅ 活动首页获取成功");

  /**
   * 3. 签到
   */
  console.log("🔄 正在签到...");
  const signRes = await postJson(API.SIGN_IN, baseHeaders, activityBody());

  if (signRes?.code === "0") {
    summary.sign = "签到成功";
    console.log("✅ 签到成功");
  } else {
    summary.sign = signRes?.message || "签到失败";
    console.log(`⚠️ 签到结果：${summary.sign}`);
  }

  await randomDelay();

  /**
   * 4. 浏览任务
   */
  if (CONFIG.DO_BROWSE_TASK) {
    const browseResults = await executeBrowseTasks(token, cookie, homeData);
    summary.browse = browseResults;
  } else {
    console.log("⏭️ 浏览任务已关闭");
  }

  await randomDelay();

  /**
   * 5. 领取奖励
   */
  if (CONFIG.DO_CLAIM_REWARD) {
    const claimResults = await claimRewards(baseHeaders);
    summary.rewards = claimResults;
  } else {
    console.log("⏭️ 奖励领取已关闭");
  }

  await randomDelay();

  /**
   * 6. 查询最终金额
   *
   * 接口返回单位通常是“分”
   * 例如：8505 = 85.05元
   */
  const finalHome = await getHomePage(baseHeaders);

  if (finalHome?.code === "0" && finalHome?.result) {
    summary.sumAward = formatMoney(finalHome.result.sumAward);
    summary.sumAllowWithdraw = formatMoney(finalHome.result.sumAllowWithdraw);
  }

  console.log(`💰 累计金额：${summary.sumAward}`);
  console.log(`💵 可提现金额：${summary.sumAllowWithdraw}`);

  const notifyMsg = formatNotify(index, userInfo, summary, id);

  console.log("\n" + notifyMsg);

  return {
    userInfo,
    summary,
    notifyMsg
  };
}

/**
 * ==============================
 * 获取首页
 * ==============================
 */
async function getHomePage(headers) {
  return await postJson(API.HOME_PAGE, headers, activityBody());
}

/**
 * ==============================
 * 执行浏览任务
 * ==============================
 */
async function executeBrowseTasks(token, cookie, homeData) {
  const results = [];

  const productRecommend = homeData?.result?.productRecommend;

  if (!productRecommend || Object.keys(productRecommend).length === 0) {
    console.log("ℹ️ 没有可执行的浏览任务");
    return results;
  }

  if (!cookie) {
    console.log("⚠️ 未填写 Cookie，跳过浏览任务");
    results.push("未获取 Cookie，跳过浏览任务");
    return results;
  }

  const productIds = Object.keys(productRecommend);
  const maxCount = Math.min(productIds.length, 3);

  console.log(`🔄 发现 ${productIds.length} 个浏览任务，准备执行 ${maxCount} 个`);

  const taskHeaders = buildTaskHeaders(token, cookie);

  for (let i = 0; i < maxCount; i++) {
    const goodsCode = productIds[i];

    const body = {
      activityCode: CONFIG.ACTIVITY_CODE,
      channelCode: "1000000004",
      goodsCode,
      taskId: "110"
    };

    const res = await postJson(API.BROWSE_REWARD, taskHeaders, body);

    if (res?.code === "0") {
      const msg = `浏览任务 ${i + 1}/${maxCount} 完成`;
      console.log(`✅ ${msg}`);
      results.push(msg);
    } else {
      const msg = `浏览任务 ${i + 1} 失败：${res?.message || "未知错误"}`;
      console.log(`⚠️ ${msg}`);
      results.push(msg);
    }

    await randomDelay();
  }

  return results;
}

/**
 * ==============================
 * 领取奖励
 * ==============================
 */
async function claimRewards(headers) {
  const results = [];

  const home = await getHomePage(headers);

  if (home?.code !== "0") {
    const msg = `获取奖励列表失败：${home?.message || "未知错误"}`;
    console.log(`⚠️ ${msg}`);
    results.push(msg);
    return results;
  }

  const rewardList = home?.result?.valuableRewardList || [];

  if (rewardList.length === 0) {
    console.log("ℹ️ 没有可领取的奖励");
    return results;
  }

  console.log(`🎁 发现 ${rewardList.length} 个可领取奖励`);

  for (let i = 0; i < rewardList.length; i++) {
    const reward = rewardList[i];

    const body = {
      channelCode: CONFIG.CHANNEL_CODE,
      activityCode: CONFIG.ACTIVITY_CODE,
      id: reward.awardDetailId
    };

    const res = await postJson(API.LOTTERY, headers, body);

    if (res?.code === "0") {
      const amountText =
        reward.amount === undefined || reward.amount === null || reward.amount === ""
          ? ""
          : formatMoney(reward.amount);

      const msg = `${reward.desc || "奖励"}${amountText ? "：" + amountText : ""}`;
      console.log(`🎉 领取成功：${msg}`);
      results.push(`领取成功：${msg}`);
    } else {
      const msg = `领取失败：${res?.message || "未知错误"}`;
      console.log(`⚠️ ${msg}`);
      results.push(msg);
    }

    await randomDelay();
  }

  return results;
}

/**
 * ==============================
 * 通知格式
 * ==============================
 */
function formatNotify(index, userInfo, summary, id) {
  const browseText =
    summary.browse.length > 0
      ? summary.browse.map(item => `   ${item}`).join("\n")
      : "   无浏览任务";

  const rewardText =
    summary.rewards.length > 0
      ? summary.rewards.map(item => `   ${item}`).join("\n")
      : "   无可领取奖励";

  return (
    `👤 账号 ${index}\n` +
    `🆔 ID：${id || "未知"}\n` +
    `🔹 昵称：${userInfo.nickName}\n` +
    `📱 手机：${userInfo.phone}\n\n` +

    `✅ 签到：${summary.sign}\n\n` +

    `📌 浏览任务：\n${browseText}\n\n` +

    `🎁 奖励领取：\n${rewardText}\n\n` +

    `💰 累计金额：${summary.sumAward}\n` +
    `💵 可提现金额：${summary.sumAllowWithdraw}`
  );
}

/**
 * ==============================
 * 请求封装
 * ==============================
 */
async function postJson(url, headers, bodyObj) {
  const options = {
    url,
    method: "POST",
    headers,
    body: JSON.stringify(bodyObj),
    timeout: 8000
  };

  debugLog(`\n【debug】请求：${url}`);
  debugLog(JSON.stringify({
    ...options,
    headers: maskHeaders(headers)
  }, null, 2));

  const res = await request(options);

  debugLog("【debug】响应：");
  debugLog(res.body);

  return parseJsonSafe(res.body);
}

function request(options) {
  return new Promise((resolve, reject) => {
    $task.fetch(options).then(
      response => {
        const statusCode = response.statusCode || response.status || 0;

        if (statusCode >= 200 && statusCode < 400) {
          resolve(response);
        } else {
          reject(
            new Error(
              `HTTP ${statusCode} ${
                response.body ? String(response.body).slice(0, 150) : ""
              }`
            )
          );
        }
      },
      error => {
        reject(
          new Error(
            error.error ||
            error.message ||
            JSON.stringify(error)
          )
        );
      }
    );
  });
}

/**
 * ==============================
 * Header
 * ==============================
 */
function buildBaseHeaders(token, cookie) {
  const headers = {
    "Host": CONFIG.HOST,
    "Connection": "keep-alive",
    "Access-Token": token,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Accept-Encoding": "gzip,compress,br,deflate",
    "User-Agent": CONFIG.USER_AGENT,
    "Referer": CONFIG.REFERER
  };

  if (cookie) {
    headers["Cookie"] = cookie;
  }

  return headers;
}

function buildTaskHeaders(token, cookie) {
  return {
    "Host": CONFIG.HOST,
    "Connection": "keep-alive",
    "Access-Token": token,
    "Content-Type": "application/json",
    "Origin": "https://ihealth.zhongan.com",
    "Accept": "application/json",
    "Accept-Encoding": "gzip, deflate, br",
    "Cookie": cookie,
    "User-Agent":
      CONFIG.USER_AGENT + " miniProgram/wxbac45cc1588a5a75",
    "Referer":
      "https://ihealth.zhongan.com/insure/gt?activityCode=ONA20220411001",
    "Accept-Language": "zh-cn"
  };
}

function activityBody() {
  return {
    activityCode: CONFIG.ACTIVITY_CODE,
    channelCode: CONFIG.CHANNEL_CODE
  };
}

/**
 * ==============================
 * 本地账号存储
 * ==============================
 */
function loadAccountsFromStore() {
  const store = loadAccountStore();

  if (!store || !store.accounts) {
    return [];
  }

  const ids = Array.isArray(store.order)
    ? store.order
    : Object.keys(store.accounts);

  return ids
    .map(id => {
      const acc = store.accounts[id];

      if (!acc || !acc.token) {
        return null;
      }

      return {
        id,
        token: acc.token,
        cookie: acc.cookie || "",
        alias: acc.alias || "",
        phone: acc.phone || ""
      };
    })
    .filter(Boolean);
}

function loadAccountStore() {
  const raw = $prefs.valueForKey(STORE_KEY);

  if (!raw) {
    return {
      version: 1,
      accounts: {},
      order: [],
      updatedAt: Date.now()
    };
  }

  try {
    const store = JSON.parse(raw);

    if (!store.accounts) {
      store.accounts = {};
    }

    if (!Array.isArray(store.order)) {
      store.order = Object.keys(store.accounts);
    }

    return store;
  } catch (e) {
    console.log(`⚠️ 本地账号数据解析失败，重新初始化：${e.message}`);

    return {
      version: 1,
      accounts: {},
      order: [],
      updatedAt: Date.now()
    };
  }
}

function saveAccountStore(store) {
  $prefs.setValueForKey(JSON.stringify(store), STORE_KEY);
}

function updateStoredAccountMeta(id, meta) {
  const store = loadAccountStore();

  if (!store.accounts || !store.accounts[id]) {
    return;
  }

  if (meta.alias && meta.alias !== "未知") {
    store.accounts[id].alias = meta.alias;
  }

  if (meta.phone && meta.phone !== "未获取到") {
    store.accounts[id].phone = meta.phone;
  }

  store.accounts[id].updatedAt = Date.now();
  store.updatedAt = Date.now();

  saveAccountStore(store);
}

function findAccountId(store, token, cookie) {
  const ids = store.order || [];

  for (const id of ids) {
    const acc = store.accounts[id];

    if (!acc) {
      continue;
    }

    if (acc.token === token) {
      return id;
    }

    if (cookie && acc.cookie && acc.cookie === cookie) {
      return id;
    }
  }

  return "";
}

function makeAccountId(token, cookie) {
  return simpleHash(`${token}|${cookie || ""}`).slice(0, 12);
}

function simpleHash(str) {
  str = String(str || "");

  let h = 2166136261;

  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h +=
      (h << 1) +
      (h << 4) +
      (h << 7) +
      (h << 8) +
      (h << 24);
  }

  return (
    ("00000000" + (h >>> 0).toString(16)).slice(-8) +
    String(str.length).padStart(4, "0")
  );
}

/**
 * ==============================
 * 工具函数
 * ==============================
 */
function getHeader(headers, name) {
  const target = String(name).toLowerCase();

  for (const key in headers) {
    if (String(key).toLowerCase() === target) {
      return headers[key];
    }
  }

  return "";
}

function parseJsonSafe(str) {
  if (!str) return null;

  try {
    return JSON.parse(str);
  } catch (e) {
    console.log(`❌ JSON 解析失败：${e.message}`);
    console.log(String(str).slice(0, 300));
    return null;
  }
}

function maskPhone(phone) {
  return String(phone || "").replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
}

function maskText(str) {
  str = String(str || "");

  if (!str) {
    return "";
  }

  if (str.length <= 12) {
    return "***";
  }

  return str.slice(0, 6) + "****" + str.slice(-4);
}

function maskHeaders(headers) {
  const obj = {};

  for (const key in headers) {
    const lower = String(key).toLowerCase();

    if (
      lower === "access-token" ||
      lower === "cookie" ||
      lower === "authorization"
    ) {
      obj[key] = maskText(headers[key]);
    } else {
      obj[key] = headers[key];
    }
  }

  return obj;
}

/**
 * 金额格式化
 * 接口返回单位：分
 * 例如 8505 => 85.05元
 */
function formatMoney(value) {
  if (value === null || value === undefined || value === "") {
    return "0.00元";
  }

  const num = Number(value);

  if (isNaN(num)) {
    return String(value);
  }

  return (num / 100).toFixed(2) + "元";
}

function randomDelay(min = CONFIG.DELAY_MIN, max = CONFIG.DELAY_MAX) {
  const delay = randomInt(min, max);
  console.log(`⌛️ 等待 ${delay}ms`);
  return sleep(delay);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function debugLog(...args) {
  if (CONFIG.DEBUG) {
    console.log(...args);
  }
}

function notify(title, subtitle, message) {
  if (!CONFIG.NOTIFY) return;

  if (typeof $notify !== "undefined") {
    $notify(title, subtitle, message);
  }
}