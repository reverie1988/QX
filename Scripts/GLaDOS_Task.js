/******************************
 * Quantumult X - GLaDOS 签到 + 积分查询 + 自动兑换
 *
 * 功能：
 * 1. 多账号签到
 * 2. 查询剩余天数
 * 3. 查询总积分
 * 4. 积分达到要求后自动兑换
 * 5. 优化日志与推送内容
 *
 * 兑换规则：
 * plan100 = 100积分兑换10天
 * plan200 = 200积分兑换30天
 * plan500 = 500积分兑换100天
 ******************************/

console.log("GLaDOS Checkin Start");

// ==================== 配置区 ====================

// 是否开启详细日志
const DEBUG = false;

// 是否自动兑换
const AUTO_EXCHANGE = true;

// 默认兑换计划：plan100 / plan200 / plan500
const EXCHANGE_PLAN = "plan500";

// 账号 Cookie，一行一个账号
const STORE_KEY = 'glados_accounts_v1';

function loadLocalCookies() {
  const raw = $prefs.valueForKey(STORE_KEY);

  if (!raw) {
    return [];
  }

  let store;

  try {
    store = JSON.parse(raw);
  } catch (e) {
    console.log('❌ 本地账号数据解析失败');
    return [];
  }

  if (!store.accounts) {
    return [];
  }

  const ids = Array.isArray(store.order)
    ? store.order
    : Object.keys(store.accounts);

  const cookies = [];

  ids.forEach(id => {
    const acc = store.accounts[id];

    if (acc && acc.cookie) {
      cookies.push(acc.cookie);
    }
  });

  return cookies;
}

const COOKIES = loadLocalCookies();

// ==================== API 地址 ====================

const CHECKIN_URL = "https://glados.cloud/api/user/checkin";
const STATUS_URL = "https://glados.cloud/api/user/status";
const POINTS_URL = "https://glados.cloud/api/user/points";
const EXCHANGE_URL = "https://glados.cloud/api/user/exchange";

// ==================== 请求参数 ====================

const CHECKIN_DATA = {
  token: "glados.cloud"
};

const EXCHANGE_PLANS = {
  plan100: {
    points: 100,
    days: 10,
    name: "100积分兑换10天"
  },
  plan200: {
    points: 200,
    days: 30,
    name: "200积分兑换30天"
  },
  plan500: {
    points: 500,
    days: 100,
    name: "500积分兑换100天"
  }
};

const HEADERS_TEMPLATE = {
  "Referer": "https://glados.cloud/console/checkin",
  "Origin": "https://glados.cloud",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36",
  "Content-Type": "application/json;charset=UTF-8",
  "Accept": "application/json, text/plain, */*"
};

// ==================== 工具函数 ====================

function log(msg) {
  console.log(msg);
}

function debugLog(msg) {
  if (DEBUG) {
    console.log(msg);
  }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function toIntString(value, failText) {
  try {
    if (value === undefined || value === null || value === "") {
      return failText;
    }
    return String(parseInt(Number(value), 10));
  } catch (e) {
    return failText;
  }
}

function getPlanInfo(plan) {
  if (EXCHANGE_PLANS[plan]) {
    return EXCHANGE_PLANS[plan];
  }
  return EXCHANGE_PLANS.plan500;
}

function getValidExchangePlan(plan) {
  if (EXCHANGE_PLANS[plan]) {
    return plan;
  }
  return "plan500";
}

function makeRequest(url, method, cookie, data) {
  const headers = Object.assign({}, HEADERS_TEMPLATE, {
    "Cookie": cookie
  });

  const req = {
    url: url,
    method: method,
    headers: headers
  };

  if (data !== undefined && data !== null) {
    req.body = JSON.stringify(data);
  }

  debugLog(`请求：${method} ${url}`);
  debugLog(`请求头：${JSON.stringify(headers)}`);

  if (data !== undefined && data !== null) {
    debugLog(`请求体：${JSON.stringify(data)}`);
  }

  return $task.fetch(req).then(function (response) {
    const statusCode = response.statusCode || response.status || 0;
    const body = response.body || "";

    debugLog(`状态码：${statusCode}`);
    debugLog(`响应内容：${body}`);

    return {
      ok: statusCode >= 200 && statusCode < 300,
      statusCode: statusCode,
      body: body
    };
  }).catch(function (error) {
    log(`❌ 网络请求异常：${JSON.stringify(error)}`);
    return null;
  });
}

function parseCheckinStatus(checkinData) {
  const msg = checkinData && checkinData.message ? checkinData.message : "";
  const points = checkinData && checkinData.points ? String(checkinData.points) : "0";

  // 签到成功
  if (
    msg.indexOf("Checkin! Got") !== -1 ||
    msg.indexOf("Got") !== -1 ||
    msg.indexOf("获得") !== -1
  ) {
    return {
      status: `签到成功，获得 ${points} 点积分`,
      statusType: "success",
      points: points
    };
  }

  // 今日已签到
  if (
    msg.indexOf("Checkin Repeats") !== -1 ||
    msg.indexOf("Today's observation logged") !== -1 ||
    msg.indexOf("Return tomorrow") !== -1 ||
    msg.indexOf("already") !== -1 ||
    msg.indexOf("重复") !== -1 ||
    msg.indexOf("明天") !== -1
  ) {
    return {
      status: "今日已签到，明天再来",
      statusType: "repeat",
      points: "0"
    };
  }

  // 其他异常
  return {
    status: msg ? `签到异常：${msg}` : "签到异常：无返回消息",
    statusType: "error",
    points: "0"
  };
}

// ==================== 核心签到逻辑 ====================

async function checkinAndProcess(cookie, exchangePlan) {
  let userEmail = "未知用户";
  let statusMsg = "签到请求失败";
  let statusType = "error";
  let pointsGained = "0";
  let remainingDays = "获取失败";
  let remainingPoints = "获取失败";
  let exchangeMsg = "兑换跳过或失败";

  const planInfo = getPlanInfo(exchangePlan);

  // 1. 查询账户状态
  const statusResponse = await makeRequest(STATUS_URL, "GET", cookie, null);

  if (statusResponse && statusResponse.body) {
    const statusData = safeJsonParse(statusResponse.body);

    if (statusData && statusData.data) {
      if (statusData.data.email) {
        userEmail = statusData.data.email;
      }

      remainingDays = toIntString(statusData.data.leftDays, "获取失败");
    } else {
      debugLog("账户状态 JSON 解析失败");
    }
  }

  // 2. 执行签到
  const checkinResponse = await makeRequest(CHECKIN_URL, "POST", cookie, CHECKIN_DATA);

  if (checkinResponse && checkinResponse.body) {
    const checkinData = safeJsonParse(checkinResponse.body);

    if (checkinData) {
      const parsed = parseCheckinStatus(checkinData);
      statusMsg = parsed.status;
      statusType = parsed.statusType;
      pointsGained = parsed.points;
    } else {
      statusMsg = "签到响应解析失败";
      statusType = "error";
      pointsGained = "0";
    }
  } else {
    statusMsg = "签到请求失败";
    statusType = "error";
    pointsGained = "0";
  }

  // 3. 查询积分
  const pointsResponse = await makeRequest(POINTS_URL, "GET", cookie, null);

  if (pointsResponse && pointsResponse.body) {
    const pointsData = safeJsonParse(pointsResponse.body);

    if (pointsData && pointsData.points !== undefined && pointsData.points !== null) {
      remainingPoints = toIntString(pointsData.points, "获取失败");
    } else {
      remainingPoints = "获取失败";
    }
  }

  // 4. 判断是否兑换
  let currentPointsNumeric = 0;

  if (remainingPoints !== "获取失败") {
    currentPointsNumeric = parseInt(remainingPoints, 10) || 0;
  }

  const requiredPoints = planInfo.points;

  if (!AUTO_EXCHANGE) {
    exchangeMsg = `自动兑换已关闭：${planInfo.name}`;
  } else if (currentPointsNumeric >= requiredPoints) {
    const exchangeResponse = await makeRequest(
      EXCHANGE_URL,
      "POST",
      cookie,
      {
        planType: exchangePlan
      }
    );

    if (exchangeResponse && exchangeResponse.body) {
      const exchangeData = safeJsonParse(exchangeResponse.body);

      if (exchangeData) {
        const code = exchangeData.code;
        const detailedMsg = exchangeData.message || "未知错误";

        if (code === 0) {
          exchangeMsg = `兑换成功：${planInfo.name}`;
        } else {
          exchangeMsg = `兑换失败：${planInfo.name}，代码 ${code}，${detailedMsg}`;
        }
      } else {
        exchangeMsg = `兑换响应解析失败：${planInfo.name}`;
      }
    } else {
      exchangeMsg = `兑换请求失败：${planInfo.name}`;
    }
  } else {
    exchangeMsg = `积分不足，未兑换：${planInfo.name}`;
  }

  return {
    email: userEmail,
    status: statusMsg,
    status_type: statusType,
    points: pointsGained,
    days: remainingDays,
    points_total: remainingPoints,
    exchange: exchangeMsg
  };
}

// ==================== 推送格式 ====================

function formatPushContent(results) {
  let successCount = 0;
  let repeatCount = 0;
  let errorCount = 0;

  results.forEach(function (res) {
    if (res.status_type === "success") {
      successCount++;
    } else if (res.status_type === "repeat") {
      repeatCount++;
    } else {
      errorCount++;
    }
  });

  const lines = [];

  lines.push(`📌 账号总数：${results.length}`);
  lines.push(`✅ 成功：${successCount}  ⚠️ 已签：${repeatCount}  ❌ 异常：${errorCount}`);
  lines.push("");

  results.forEach(function (res, index) {
    let statusIcon = "❌";

    if (res.status_type === "success") {
      statusIcon = "✅";
    } else if (res.status_type === "repeat") {
      statusIcon = "⚠️";
    }

    lines.push(`账号 ${index + 1}`);
    lines.push(`🆔 ${res.email}`);
    lines.push(`${statusIcon} ${res.status}`);
    lines.push(`🔆 积分：${res.points_total}`);
    lines.push(`📅 剩余：${res.days} 天`);
    lines.push(`🔄 ${res.exchange}`);

    if (index < results.length - 1) {
      lines.push("");
    }
  });

  return lines.join("\n");
}

// ==================== 主程序 ====================

async function main() {
  try {
    if (!COOKIES || COOKIES.length === 0) {
      const msg = "未配置 Cookie，请在脚本顶部 COOKIES 中填写账号 Cookie。";
      log(msg);
      $notify("GLaDOS 签到结果", "执行失败", msg);
      $done();
      return;
    }

    const exchangePlan = getValidExchangePlan(EXCHANGE_PLAN);
    const planInfo = getPlanInfo(exchangePlan);

    log(`账号数量：${COOKIES.length}`);
    log(`兑换计划：${exchangePlan}，${planInfo.name}`);
    log(`自动兑换：${AUTO_EXCHANGE ? "开启" : "关闭"}`);
    log(`详细日志：${DEBUG ? "开启" : "关闭"}`);

    const results = [];

    for (let i = 0; i < COOKIES.length; i++) {
      const cookie = COOKIES[i].trim();

      if (!cookie || cookie.indexOf("这里粘贴") !== -1) {
        log(`账号 ${i + 1}：Cookie 未填写，跳过`);
        continue;
      }

      log(`开始处理账号 ${i + 1}/${COOKIES.length}`);

      const result = await checkinAndProcess(cookie, exchangePlan);

      results.push(result);

      log(`账号 ${i + 1}：${result.email}`);
      log(`${result.status}｜积分 ${result.points_total}｜剩余 ${result.days} 天`);
    }

    if (results.length === 0) {
      const msg = "没有可用账号，请检查 COOKIES 配置。";
      log(msg);
      $notify("GLaDOS 签到结果", "执行失败", msg);
      $done();
      return;
    }

    const pushContent = formatPushContent(results);

    log("所有账号处理完成");
    log(pushContent);

    $notify("GLaDOS 签到结果", "", pushContent);

  } catch (e) {
    const errorMsg = `脚本执行异常：${e.message || e}`;
    log(errorMsg);

    if (DEBUG && e.stack) {
      log(e.stack);
    }

    $notify("GLaDOS 签到结果", "脚本执行异常", errorMsg);
  }

  $done();
}

main();
