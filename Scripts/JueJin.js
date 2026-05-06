// 2026/05/06
/*
项目: 稀土掘金
名称: 稀土掘金 QX 签到
用途:
1. 自动从 APP 请求中提取 Cookie 和 URL 参数
2. 保存到 Quantumult X 本地 $prefs
3. 定时读取本地数据完成签到

抓包接口:
https://api.juejin.cn/growth_api/v1/check_in?

QX rewrite 示例:
hostname = api.juejin.cn
^https:\/\/api\.juejin\.cn\/growth_api\/v1\/check_in\? url script-request-header JueJin_QX.js

QX task 示例:
30 8 * * * JueJin_QX.js, tag=稀土掘金签到, enabled=true
*/

const SCRIPT_NAME = '🌋 稀土掘金';
const COOKIE_KEY = 'JueJin_Cookie';
const URL_KEY = 'JueJin_URL';
const UA_KEY = 'JueJin_UserAgent';
const LAST_CAPTURE_KEY = 'JueJin_LastCapture';
const LAST_RESULT_KEY = 'JueJin_LastResult';

// 是否在日志中显示完整 Cookie。Cookie 是敏感信息，默认关闭。
const SHOW_FULL_COOKIE_IN_LOG = false;

// 请求重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

const DEFAULT_USER_AGENT = 'xitu 6.7.5 rv:6.7.5.2 (iPhone; iOS 17.1; zh_CN) Cronet';

const $ = new Env(SCRIPT_NAME);

!(async () => {
  if (typeof $request !== 'undefined' && $request && $request.headers) {
    captureCookie();
  } else {
    await checkIn();
  }
})()
  .catch(e => {
    const err = e && e.message ? e.message : String(e);
    console.log(`❌ 脚本异常：${err}`);
    $.msg(SCRIPT_NAME, '脚本异常', err);
  })
  .finally(() => {
    $.done({});
  });

function nowTime() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function logBlock(title, rows) {
  const body = rows
    .filter(v => v !== undefined && v !== null && v !== '')
    .map(v => `│ ${v}`)
    .join('\n');

  console.log(
    `\n【${SCRIPT_NAME} ${nowTime()}】┌ ${title}\n` +
    body +
    `\n【${SCRIPT_NAME} ${nowTime()}】└────────────────────────────`
  );
}

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}

function shortText(text, maxLen) {
  if (!text) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}

function getHeaderIgnoreCase(headers, name) {
  if (!headers) return '';

  const target = String(name).toLowerCase();

  for (const k in headers) {
    if (
      Object.prototype.hasOwnProperty.call(headers, k) &&
      String(k).toLowerCase() === target
    ) {
      return headers[k];
    }
  }

  return '';
}

function maskCookie(cookie) {
  if (!cookie) return '';

  if (SHOW_FULL_COOKIE_IN_LOG) {
    return String(cookie);
  }

  return String(cookie)
    .replace(/(__tea_cookie_tokens_[^=]*=)[^;]+/gi, '$1***')
    .replace(/(sessionid=)[^;]+/gi, '$1***')
    .replace(/(sessionid_ss=)[^;]+/gi, '$1***')
    .replace(/(sid_guard=)[^;]+/gi, '$1***')
    .replace(/(uid_tt=)[^;]+/gi, '$1***')
    .replace(/(uid_tt_ss=)[^;]+/gi, '$1***')
    .replace(/(sid_tt=)[^;]+/gi, '$1***')
    .replace(/(csrf_session_id=)[^;]+/gi, '$1***')
    .replace(/(passport_csrf_token=)[^;]+/gi, '$1***')
    .replace(/(passport_csrf_token_default=)[^;]+/gi, '$1***');
}

function getQueryFromUrl(url) {
  const s = String(url || '');
  const idx = s.indexOf('?');

  if (idx < 0) return '';

  return s.slice(idx + 1).trim();
}

function setPrefs(key, value) {
  return $.setdata(String(value || ''), key);
}

function getPrefs(key) {
  return $.getdata(key) || '';
}

function captureCookie() {
  const headers = $request.headers || {};
  const url = $request.url || '';

  const cookie =
    getHeaderIgnoreCase(headers, 'Cookie') ||
    getHeaderIgnoreCase(headers, 'cookie');

  const ua =
    getHeaderIgnoreCase(headers, 'User-Agent') ||
    getHeaderIgnoreCase(headers, 'user-agent') ||
    DEFAULT_USER_AGENT;

  const query = getQueryFromUrl(url);

  if (!cookie) {
    logBlock('⚠️ 未找到 Cookie', [
      `请求 URL：${shortText(url, 260)}`,
      `Header 数量：${Object.keys(headers).length}`,
      '请确认抓的是 APP 的 check_in 请求'
    ]);

    $.msg(SCRIPT_NAME, 'Cookie 获取失败', '未在请求头中找到 Cookie');
    return;
  }

  if (!query) {
    logBlock('⚠️ 未找到 URL 参数', [
      `请求 URL：${shortText(url, 260)}`,
      'check_in? 后面没有参数'
    ]);

    $.msg(SCRIPT_NAME, 'URL 参数获取失败', '未找到 check_in? 后面的参数');
    return;
  }

  const oldCookie = getPrefs(COOKIE_KEY);
  const oldQuery = getPrefs(URL_KEY);
  const oldUa = getPrefs(UA_KEY);

  const changed = oldCookie !== cookie || oldQuery !== query || oldUa !== ua;
  const now = new Date().toLocaleString();

  if (!changed) {
    logBlock('⏸ 掘金 Cookie 未变化', [
      `时间：${now}`,
      `Cookie：${shortText(maskCookie(cookie), 300)}`,
      `URL 参数：${shortText(query, 300)}`
    ]);
    return;
  }

  setPrefs(COOKIE_KEY, cookie);
  setPrefs(URL_KEY, query);
  setPrefs(UA_KEY, ua);

  setPrefs(
    LAST_CAPTURE_KEY,
    JSON.stringify({
      time: now,
      url,
      query,
      userAgent: ua,
      cookie
    })
  );

  logBlock('✅ 掘金 Cookie 已保存', [
    `时间：${now}`,
    `Cookie Key：${COOKIE_KEY}`,
    `URL Key：${URL_KEY}`,
    `UA Key：${UA_KEY}`,
    `Cookie：${shortText(maskCookie(cookie), 300)}`,
    `URL 参数：${shortText(query, 300)}`,
    `User-Agent：${shortText(ua, 220)}`
  ]);

  $.msg(
    SCRIPT_NAME,
    'Cookie 已保存',
    `时间: ${now}\nURL 参数: ${shortText(query, 120)}`
  );
}

async function checkIn() {
  const cookieValue = getPrefs(COOKIE_KEY).trim();
  const appendUrl = getPrefs(URL_KEY).trim();
  const userAgent = getPrefs(UA_KEY).trim() || DEFAULT_USER_AGENT;

  if (!cookieValue || !appendUrl) {
    const missing = [
      !cookieValue ? COOKIE_KEY : '',
      !appendUrl ? URL_KEY : ''
    ].filter(Boolean).join('、');

    const msg = [
      '❌ 执行中断，本地数据未配置',
      `缺少：${missing}`,
      '',
      '请先打开稀土掘金 APP，触发 check_in 接口，让 QX rewrite 自动保存 Cookie。'
    ].join('\n');

    console.log(msg);
    $.msg(SCRIPT_NAME, '签到失败', msg);
    return;
  }

  const checkInUrl = `https://api.juejin.cn/growth_api/v1/check_in?${appendUrl}`;

  const headers = {
    'User-Agent': userAgent,
    'origin': 'https://juejin.cn',
    'referer': 'https://juejin.cn/',
    'content-type': 'application/json',
    'cookie': cookieValue
  };

  logBlock('🚀 开始签到', [
    `URL：${shortText(checkInUrl, 300)}`,
    `Cookie：${shortText(maskCookie(cookieValue), 300)}`,
    `User-Agent：${shortText(userAgent, 220)}`
  ]);

  try {
    const result = await requestWithRetry({
      url: checkInUrl,
      method: 'POST',
      headers,
      body: '{}'
    });

    const errNo = result && result.err_no;
    const errMsg = result && result.err_msg;
    const data = result && result.data;

    let notifyMessage = '';

    if (errMsg === 'success' || errNo === 0) {
      const incrPoint = data && data.incr_point !== undefined ? data.incr_point : '未知';
      const sumPoint = data && data.sum_point !== undefined ? data.sum_point : '未知';

      notifyMessage = [
        '✅ 掘金签到成功',
        `⛏️ 获得矿石：${incrPoint}`,
        `🪨 总矿石：${sumPoint}`
      ].join('\n');

      logBlock('✅ 签到成功', [
        `获得矿石：${incrPoint}`,
        `总矿石：${sumPoint}`,
        `接口消息：${errMsg || 'success'}`
      ]);
    } else {
      notifyMessage = [
        '❌ 掘金签到失败',
        `错误码：${errNo !== undefined ? errNo : '未知'}`,
        `错误信息：${errMsg || '未知'}`,
        `返回：${shortText(JSON.stringify(result), 500)}`
      ].join('\n');

      logBlock('❌ 签到失败', [
        `错误码：${errNo !== undefined ? errNo : '未知'}`,
        `错误信息：${errMsg || '未知'}`,
        `返回：${shortText(JSON.stringify(result), 500)}`
      ]);
    }

    setPrefs(
      LAST_RESULT_KEY,
      JSON.stringify({
        time: new Date().toLocaleString(),
        success: errMsg === 'success' || errNo === 0,
        result
      })
    );

    $.msg(SCRIPT_NAME, '签到结果', notifyMessage);
  } catch (e) {
    const err = e && e.message ? e.message : String(e);

    const notifyMessage = [
      '❌ 掘金签到请求失败',
      `错误：${err}`,
      `已重试：${MAX_RETRIES} 次`
    ].join('\n');

    console.log(notifyMessage);
    $.msg(SCRIPT_NAME, '请求失败', notifyMessage);
  }
}

async function requestWithRetry(options, retries = 0) {
  try {
    const data = await httpRequest(options);
    return data;
  } catch (e) {
    if (retries < MAX_RETRIES) {
      console.log(`请求失败，第 ${retries + 1} 次重试... ${e && e.message ? e.message : e}`);
      await wait(RETRY_DELAY);
      return requestWithRetry(options, retries + 1);
    }

    throw e;
  }
}

function httpRequest(options) {
  return new Promise((resolve, reject) => {
    const method = String(options.method || 'GET').toUpperCase();

    const opt = {
      url: options.url,
      method,
      headers: options.headers || {}
    };

    if (method !== 'GET') {
      opt.body = options.body || '';
    }

    $task.fetch(opt).then(
      resp => {
        const statusCode = resp.statusCode;
        const body = resp.body || '';

        if (statusCode < 200 || statusCode >= 400) {
          reject(new Error(`HTTP ${statusCode}: ${shortText(body, 300)}`));
          return;
        }

        const json = safeJsonParse(body, null);

        if (json === null) {
          reject(new Error(`响应不是 JSON：${shortText(body, 300)}`));
          return;
        }

        resolve(json);
      },
      err => {
        reject(new Error(err && err.error ? err.error : String(err)));
      }
    );
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function Env(name) {
  return new class {
    constructor(name) {
      this.name = name;
      this.startTime = Date.now();
      console.log(`\n          ${this.name}`);
    }

    getdata(key) {
      if (typeof $prefs !== 'undefined') {
        return $prefs.valueForKey(key);
      }

      return '';
    }

    setdata(value, key) {
      if (typeof $prefs !== 'undefined') {
        return $prefs.setValueForKey(value, key);
      }

      return false;
    }

    msg(title = this.name, subtitle = '', body = '', opts = {}) {
      if (typeof $notify !== 'undefined') {
        $notify(title, subtitle, body, opts);
      }

      console.log(
        `\n==============📣系统通知📣==============\n${title}\n${subtitle}\n${body}`
      );
    }

    done(value = {}) {
      const cost = ((Date.now() - this.startTime) / 1000).toFixed(2);
      console.log(`\n${this.name} 运行结束，用时 ${cost}s`);

      if (typeof $done !== 'undefined') {
        $done(value);
      }
    }
  }(name);
}
