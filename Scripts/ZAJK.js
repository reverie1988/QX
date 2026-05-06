// 2026/05/07
/******************************
 * Quantumult X 众安健康
 *
 * 功能：
 * 1. 自动提取 Access-Token / Cookie
 * 2. 支持 lemon / whale / caerus 等接口抓取
 * 3. Access-Token 作为账号唯一标识，适配多账号
 * 4. 修复 Token 不同但账号 ID 撞号导致只保存 1 个账号的问题
 * 5. Cookie-only 请求只缓存 Cookie，默认不强行覆盖最近账号，避免串号
 * 6. 抓到 Access-Token 后自动合并最近缓存 Cookie
 * 7. 本地持久化保存账号
 * 8. 多账号签到
 * 9. 浏览任务
 * 10. 领取奖励
 * 11. 查询累计金额 / 可提现金额
 *
 * 存储 Key：
 * zajk_accounts_v1
 * zajk_latest_cookie_v1
 *
 * 推荐 rewrite：
 *
 * hostname = ihealth.zhongan.com
 *
 * ^https:\/\/ihealth\.zhongan\.com\/api\/ url script-request-header https://raw.githubusercontent.com/reverie1988/QX/main/Scripts/ZAJK.js
 *
 * 定时任务：
 *
 * 30 8,20 * * * https://raw.githubusercontent.com/reverie1988/QX/main/Scripts/ZAJK.js, tag=众安健康签到, enabled=true
 ******************************/

const SCRIPT_NAME = "🏢 众安健康";
const STORE_KEY = "zajk_accounts_v1";
const COOKIE_CACHE_KEY = "zajk_latest_cookie_v1";

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
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.72(0x18004824) NetType/WIFI Language/zh_CN miniProgram/wxbac45cc1588a5a75",

  REFERER:
    "https://servicewechat.com/wxbac45cc1588a5a75/210/page-frame.html",

  // 只有 Cookie、没有 Access-Token 时，是否刷新最近一个已有 Token 账号
  // 多账号场景建议保持 false，避免 Cookie 串号
  COOKIE_ONLY_UPDATE_LATEST: false,

  // 有 Token、没有 Cookie 时，是否合并最近缓存的 Cookie
  TOKEN_MERGE_LATEST_COOKIE: true,

  // 缓存 Cookie 的有效合并时间，超过这个时间不自动合并
  COOKIE_CACHE_MAX_AGE: 10 * 60 * 1000
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
 * 运行入口
 * ==============================
 */
if (typeof $request !== "undefined" && $request && $request.headers) {
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
    const err = e && e.message ? e.message : String(e);
    console.log(`【${SCRIPT_NAME}】账号提取异常：${err}`);

    if (CONFIG.CAPTURE_NOTIFY) {
      $notify(SCRIPT_NAME, "❌ 账号提取异常", err);
    }
  } finally {
    $done({ headers: $request.headers });
  }
}

function captureZAJKAccount() {
  const headers = $request.headers || {};
  const url = $request.url || "";

  const token = normalizeToken(
    getHeader(headers, "Access-Token") ||
    getHeader(headers, "access-token") ||
    getHeader(headers, "AccessToken") ||
    getHeader(headers, "accessToken") ||
    getHeader(headers, "x-access-token") ||
    getHeader(headers, "Authorization") ||
    getHeader(headers, "authorization") ||
    ""
  );

  const cookie =
    getHeader(headers, "Cookie") ||
    getHeader(headers, "cookie") ||
    "";

  const now = Date.now();

  if (!token && !cookie) {
    console.log(`【${SCRIPT_NAME}】未发现 Access-Token / Cookie，跳过`);
    console.log(`【${SCRIPT_NAME}】URL：${url}`);
    console.log(`【${SCRIPT_NAME}】Header：${Object.keys(headers).join(", ")}`);
    return;
  }

  const store = loadAccountStore();

  // 1. 只要抓到 Cookie，先缓存到最新 Cookie。
  // whale / caerus 这类只有 Cookie 的接口会走这里。
  if (cookie) {
    saveLatestCookie(cookie, url, now);
  }

  // 2. 只有 Cookie、没有 Token：
  // 默认只缓存 Cookie，不新建账号，也不覆盖最近账号，避免多账号串号。
  if (!token && cookie) {
    const matchedId = findCookieAccountId(store, cookie);

    if (matchedId && store.accounts[matchedId]) {
      const old = store.accounts[matchedId];
      const changed = old.cookie !== cookie;
      const canNotify =
        CONFIG.CAPTURE_NOTIFY &&
        changed &&
        now - Number(old.lastNotifiedAt || 0) > CONFIG.CAPTURE_NOTIFY_INTERVAL;

      old.cookie = cookie;
      old.updatedAt = now;
      old.lastCookieAt = now;
      old.lastCaptureUrl = url;
      old.lastCaptureType = "仅 Cookie，匹配已有 Cookie";
      old.lastNotifiedAt = canNotify ? now : old.lastNotifiedAt || 0;

      store.updatedAt = now;
      saveAccountStore(store);

      const msg =
        `账号 ID：${matchedId}\n` +
        `Token：${old.token ? maskText(old.token) : "未获取"}\n` +
        `Cookie：已刷新\n` +
        `本次抓取：仅 Cookie，匹配已有账号\n` +
        `来源接口：${shortUrl(url)}`;

      console.log(`【${SCRIPT_NAME}】Cookie 已刷新到匹配账号\n${msg}`);

      if (canNotify) {
        $notify(SCRIPT_NAME, "✅ Cookie 已刷新", msg);
      }

      return;
    }

    if (CONFIG.COOKIE_ONLY_UPDATE_LATEST) {
      const latestId = findLatestTokenAccountId(store);

      if (latestId && store.accounts[latestId]) {
        const old = store.accounts[latestId];
        const changed = old.cookie !== cookie;
        const canNotify =
          CONFIG.CAPTURE_NOTIFY &&
          changed &&
          now - Number(old.lastNotifiedAt || 0) > CONFIG.CAPTURE_NOTIFY_INTERVAL;

        old.cookie = cookie;
        old.updatedAt = now;
        old.lastCookieAt = now;
        old.lastCaptureUrl = url;
        old.lastCaptureType = "仅 Cookie，刷新最近账号";
        old.lastNotifiedAt = canNotify ? now : old.lastNotifiedAt || 0;

        store.updatedAt = now;
        saveAccountStore(store);

        const msg =
          `账号 ID：${latestId}\n` +
          `Token：${old.token ? maskText(old.token) : "未获取"}\n` +
          `Cookie：已刷新\n` +
          `本次抓取：仅 Cookie，刷新最近账号\n` +
          `来源接口：${shortUrl(url)}`;

        console.log(`【${SCRIPT_NAME}】Cookie 已刷新到最近账号\n${msg}`);

        if (canNotify) {
          $notify(SCRIPT_NAME, "✅ Cookie 已刷新", msg);
        }

        return;
      }
    }

    const cached = loadLatestCookie();
    const msg =
      `已缓存 Cookie，等待后续 Access-Token 合并\n` +
      `Cookie：${cached.cookie ? "已缓存" : "未缓存"}\n` +
      `来源接口：${shortUrl(url)}\n\n` +
      `说明：当前是仅 Cookie 请求，不会新建账号，避免多账号串号。`;

    console.log(`【${SCRIPT_NAME}】${msg}`);

    if (CONFIG.CAPTURE_NOTIFY) {
      $notify(SCRIPT_NAME, "🍪 Cookie 已缓存", msg);
    }

    return;
  }

  // 3. 有 Token：
  // Token 是账号唯一标识。不同 Token 一定新建或更新不同账号。
  const oldId = findTokenAccountId(store, token);
  const id = oldId || makeUniqueAccountIdByToken(store, token);
  const old = store.accounts[id] || {};

  const cachedCookie = loadLatestCookie();
  const canUseCachedCookie =
    CONFIG.TOKEN_MERGE_LATEST_COOKIE &&
    cachedCookie &&
    cachedCookie.cookie &&
    now - Number(cachedCookie.updatedAt || 0) <= CONFIG.COOKIE_CACHE_MAX_AGE;

  const mergedCookie =
    cookie ||
    old.cookie ||
    (canUseCachedCookie ? cachedCookie.cookie : "");

  const isNew = !store.accounts[id];
  const tokenChanged = Boolean(old.token) && old.token !== token;
  const cookieChanged = Boolean(mergedCookie) && old.cookie !== mergedCookie;

  const canNotify =
    CONFIG.CAPTURE_NOTIFY &&
    (
      isNew ||
      tokenChanged ||
      cookieChanged ||
      now - Number(old.lastNotifiedAt || 0) > CONFIG.CAPTURE_NOTIFY_INTERVAL
    );

  store.accounts[id] = {
    id,
    alias: old.alias || `众安健康-${id.slice(0, 6)}`,
    token,
    cookie: mergedCookie,
    phone: old.phone || "",
    createdAt: old.createdAt || now,
    updatedAt: now,
    lastCaptureUrl: url,
    lastCaptureType: cookie
      ? "Token + Cookie"
      : mergedCookie
        ? "仅 Token，已合并缓存 Cookie"
        : "仅 Token",
    lastNotifiedAt: canNotify ? now : old.lastNotifiedAt || 0,
    lastTokenAt: now,
    lastCookieAt: cookie ? now : old.lastCookieAt || (mergedCookie ? cachedCookie.updatedAt || now : 0),
    lastRunAt: old.lastRunAt || "",
    lastResult: old.lastResult || null
  };

  if (!Array.isArray(store.order)) {
    store.order = [];
  }

  if (!store.order.includes(id)) {
    store.order.push(id);
  }

  store.order = store.order.filter(x => store.accounts[x]);
  store.updatedAt = now;

  saveAccountStore(store);

  const total = store.order.filter(x => store.accounts[x]).length;

  const msg =
    `账号 ID：${id}\n` +
    `Token：${token ? maskText(token) : "未获取"}\n` +
    `Cookie：${mergedCookie ? "已保存" : "未获取"}\n` +
    `本次抓取：${store.accounts[id].lastCaptureType}\n` +
    `来源接口：${shortUrl(url)}\n` +
    `当前共 ${total} 个账号`;

  console.log(`【${SCRIPT_NAME}】账号信息已保存\n${msg}`);

  if (canNotify) {
    $notify(
      SCRIPT_NAME,
      isNew ? "✅ 新账号已保存" : "✅ 账号信息已刷新",
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
        "❌ 暂无可执行账号数据\n\n" +
        "请先开启重写和 MitM，然后打开众安健康小程序页面，让 QX 自动提取 Access-Token。\n\n" +
        "推荐 rewrite：\n" +
        "^https:\\/\\/ihealth\\.zhongan\\.com\\/api\\/ url script-request-header https://raw.githubusercontent.com/reverie1988/QX/main/Scripts/ZAJK.js";

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
      console.log(`🍪 Cookie：${account.cookie ? "已保存" : "未保存"}`);
      console.log("━━━━━━━━━━━━━━━━━━━━");

      try {
        const result = await runAccount(account, i + 1);
        notifyList.push(result.notifyMsg);

        updateStoredAccountMeta(account.id, {
          lastRunAt: Date.now(),
          lastResult: result.summary
        });
      } catch (e) {
        const err = e && e.message ? e.message : String(e);

        const errMsg =
          `👤 账号 ${i + 1}\n` +
          `❌ 执行失败：${err}`;

        console.log(errMsg);
        notifyList.push(errMsg);

        updateStoredAccountMeta(account.id, {
          lastRunAt: Date.now(),
          lastResult: {
            error: err
          }
        });
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
    const msg = `❌ 脚本异常：${e && e.message ? e.message : String(e)}`;
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
  const id = account.id;
  const token = account.token;
  const cookie = account.cookie || "";

  if (!token) {
    throw new Error("账号缺少 Access-Token，无法执行任务");
  }

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

  console.log("🔄 正在获取账户信息...");
  const baseInfo = await postJson(API.BASE_INFO, baseHeaders, {});

  if (baseInfo && baseInfo.code === "0" && baseInfo.result) {
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
    console.log(`⚠️ 获取账户信息失败：${baseInfo && baseInfo.message ? baseInfo.message : "未知错误"}`);
  }

  await randomDelay();

  console.log("🔄 正在获取活动首页...");
  const homeData = await getHomePage(baseHeaders);

  if (!homeData || homeData.code !== "0") {
    throw new Error(homeData && homeData.message ? homeData.message : "获取活动首页失败，账号可能失效");
  }

  console.log("✅ 活动首页获取成功");

  console.log("🔄 正在签到...");
  const signRes = await postJson(API.SIGN_IN, baseHeaders, activityBody());

  if (signRes && signRes.code === "0") {
    summary.sign = "签到成功";
    console.log("✅ 签到成功");
  } else {
    summary.sign = signRes && signRes.message ? signRes.message : "签到失败";
    console.log(`⚠️ 签到结果：${summary.sign}`);
  }

  await randomDelay();

  if (CONFIG.DO_BROWSE_TASK) {
    const browseResults = await executeBrowseTasks(token, cookie, homeData);
    summary.browse = browseResults;
  } else {
    console.log("⏭️ 浏览任务已关闭");
  }

  await randomDelay();

  if (CONFIG.DO_CLAIM_REWARD) {
    const claimResults = await claimRewards(baseHeaders);
    summary.rewards = claimResults;
  } else {
    console.log("⏭️ 奖励领取已关闭");
  }

  await randomDelay();

  const finalHome = await getHomePage(baseHeaders);

  if (finalHome && finalHome.code === "0" && finalHome.result) {
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

  const productRecommend =
    homeData && homeData.result
      ? homeData.result.productRecommend
      : null;

  if (!productRecommend || Object.keys(productRecommend).length === 0) {
    console.log("ℹ️ 没有可执行的浏览任务");
    return results;
  }

  if (!cookie) {
    console.log("⚠️ 未获取 Cookie，跳过浏览任务");
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

    if (res && res.code === "0") {
      const msg = `浏览任务 ${i + 1}/${maxCount} 完成`;
      console.log(`✅ ${msg}`);
      results.push(msg);
    } else {
      const msg = `浏览任务 ${i + 1} 失败：${res && res.message ? res.message : "未知错误"}`;
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

  if (!home || home.code !== "0") {
    const msg = `获取奖励列表失败：${home && home.message ? home.message : "未知错误"}`;
    console.log(`⚠️ ${msg}`);
    results.push(msg);
    return results;
  }

  const rewardList =
    home &&
    home.result &&
    Array.isArray(home.result.valuableRewardList)
      ? home.result.valuableRewardList
      : [];

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

    if (res && res.code === "0") {
      const amountText =
        reward.amount === undefined || reward.amount === null || reward.amount === ""
          ? ""
          : formatMoney(reward.amount);

      const msg = `${reward.desc || "奖励"}${amountText ? "：" + amountText : ""}`;
      console.log(`🎉 领取成功：${msg}`);
      results.push(`领取成功：${msg}`);
    } else {
      const msg = `领取失败：${res && res.message ? res.message : "未知错误"}`;
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
    body: JSON.stringify(bodyObj || {}),
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
    if (typeof $task === "undefined" || !$task.fetch) {
      reject(new Error("当前环境不支持 $task.fetch，请在 Quantumult X 中运行"));
      return;
    }

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

  if (meta.lastRunAt) {
    store.accounts[id].lastRunAt = meta.lastRunAt;
  }

  if (meta.lastResult) {
    store.accounts[id].lastResult = meta.lastResult;
  }

  store.accounts[id].updatedAt = Date.now();
  store.updatedAt = Date.now();

  saveAccountStore(store);
}

function findTokenAccountId(store, token) {
  if (!token) return "";

  const ids = Array.isArray(store.order)
    ? store.order
    : Object.keys(store.accounts || {});

  for (const id of ids) {
    const acc = store.accounts[id];

    if (!acc) continue;

    if (acc.token === token) {
      return id;
    }
  }

  return "";
}

function findCookieAccountId(store, cookie) {
  if (!cookie) return "";

  const ids = Array.isArray(store.order)
    ? store.order
    : Object.keys(store.accounts || {});

  for (const id of ids) {
    const acc = store.accounts[id];

    if (!acc) continue;

    if (acc.cookie && acc.cookie === cookie) {
      return id;
    }
  }

  return "";
}

function findLatestTokenAccountId(store) {
  const ids = Array.isArray(store.order)
    ? store.order.filter(id => store.accounts && store.accounts[id])
    : Object.keys(store.accounts || {});

  const tokenIds = ids.filter(id => {
    const acc = store.accounts[id] || {};
    return Boolean(acc.token);
  });

  if (!tokenIds.length) {
    return "";
  }

  tokenIds.sort((a, b) => {
    const aa = store.accounts[a] || {};
    const bb = store.accounts[b] || {};
    return Number(bb.updatedAt || bb.createdAt || 0) - Number(aa.updatedAt || aa.createdAt || 0);
  });

  return tokenIds[0];
}

function makeUniqueAccountIdByToken(store, token) {
  const baseId = makeAccountIdByToken(token);
  let id = baseId;
  let index = 1;

  while (
    store &&
    store.accounts &&
    store.accounts[id] &&
    store.accounts[id].token &&
    store.accounts[id].token !== token
  ) {
    id = `${baseId}_${index}`;
    index++;
  }

  return id;
}

function makeAccountIdByToken(token) {
  const raw = String(token || "").trim();

  if (!raw) {
    return "unknown_" + Date.now();
  }

  return "tk_" + hash53(raw).slice(0, 12);
}

function hash53(str, seed) {
  str = String(str || "");
  seed = seed || 0;

  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);

    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);

  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const high = (h2 >>> 0).toString(16).padStart(8, "0");
  const low = (h1 >>> 0).toString(16).padStart(8, "0");

  return high + low + String(str.length).padStart(4, "0");
}

/**
 * ==============================
 * Cookie 缓存
 * ==============================
 */
function saveLatestCookie(cookie, url, time) {
  if (!cookie) return;

  const old = loadLatestCookie();

  const data = {
    cookie,
    url: url || "",
    updatedAt: time || Date.now(),
    oldUrl: old.url || "",
    oldUpdatedAt: old.updatedAt || 0
  };

  $prefs.setValueForKey(JSON.stringify(data), COOKIE_CACHE_KEY);
}

function loadLatestCookie() {
  const raw = $prefs.valueForKey(COOKIE_CACHE_KEY);

  if (!raw) {
    return {
      cookie: "",
      url: "",
      updatedAt: 0
    };
  }

  try {
    const obj = JSON.parse(raw);

    return {
      cookie: obj.cookie || "",
      url: obj.url || "",
      updatedAt: obj.updatedAt || 0
    };
  } catch (e) {
    return {
      cookie: "",
      url: "",
      updatedAt: 0
    };
  }
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

function normalizeToken(token) {
  const s = String(token || "").trim();

  if (!s) return "";

  if (/^Bearer\s+/i.test(s)) {
    return s.replace(/^Bearer\s+/i, "").trim();
  }

  return s;
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

function shortUrl(url) {
  const s = String(url || "");

  if (!s) return "";

  return s.length > 180 ? s.slice(0, 180) + "..." : s;
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

function randomDelay(min, max) {
  min = min || CONFIG.DELAY_MIN;
  max = max || CONFIG.DELAY_MAX;

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

function debugLog() {
  if (!CONFIG.DEBUG) return;
  console.log.apply(console, arguments);
}

function notify(title, subtitle, message) {
  if (!CONFIG.NOTIFY) return;

  if (typeof $notify !== "undefined") {
    $notify(title, subtitle, message);
  }
}