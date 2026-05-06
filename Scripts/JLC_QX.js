// 2026/05/06
/*
项目: 嘉立创 JLC 小程序
名称: 嘉立创签到 QX版
用途:
1. script-request-header 模式：自动获取 x-jlc-accesstoken / secretkey / cookie 并保存到 QX 本地
2. task 模式：读取本地持久化数据执行签到、领取第七天奖励、查询豆豆总数

抓包域名:
m.jlc.com

必须抓取 Header:
x-jlc-accesstoken
secretkey

QX rewrite 示例:
hostname = m.jlc.com
^https:\/\/m\.jlc\.com\/api\/activity\/ url script-request-header JLC_QX.js

QX task 示例:
30 8 * * * JLC_QX.js, tag=嘉立创签到, enabled=true
*/

const SCRIPT_NAME = '🖨️ 嘉立创';
const STORE_KEY = 'jlc_auth_store_v1';
const LAST_KEY = 'jlc_auth_last_v1';
const LAST_RESULT_KEY = 'jlc_last_result_v1';

const BASE_URL = 'https://m.jlc.com';
const PLATFORM_TYPE = 'MP-WEIXIN';
const SOURCE = '2';

// 是否在日志中显示完整 token / secret / cookie。敏感信息，默认关闭。
const SHOW_FULL_AUTH_IN_LOG = false;

// 抓到授权信息后是否通知
const NOTIFY_ON_CAPTURE = true;

// 重复抓到完全一样的数据时是否通知
const NOTIFY_ON_UNCHANGED_CAPTURE = false;

const DEFAULT_UA = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const $ = new Env(SCRIPT_NAME);

!(async () => {
  if (typeof $request !== 'undefined' && $request && $request.headers) {
    captureAuth();
  } else {
    await runTask();
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

function simpleHash(text) {
  const s = String(text || '');
  let h = 0;

  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }

  return Math.abs(h).toString(16);
}

function maskText(text) {
  if (!text) return '';

  if (SHOW_FULL_AUTH_IN_LOG) {
    return String(text);
  }

  const s = String(text);

  if (s.length <= 12) {
    return s.slice(0, 3) + '***';
  }

  return s.slice(0, 6) + '***' + s.slice(-6);
}

function maskCookie(cookie) {
  if (!cookie) return '';

  if (SHOW_FULL_AUTH_IN_LOG) {
    return String(cookie);
  }

  return String(cookie)
    .replace(/([A-Za-z0-9_\-]*token[A-Za-z0-9_\-]*=)[^;]+/gi, '$1***')
    .replace(/([A-Za-z0-9_\-]*session[A-Za-z0-9_\-]*=)[^;]+/gi, '$1***')
    .replace(/([A-Za-z0-9_\-]*cookie[A-Za-z0-9_\-]*=)[^;]+/gi, '$1***')
    .replace(/([A-Za-z0-9_\-]*id[A-Za-z0-9_\-]*=)[^;]+/gi, '$1***');
}

function decodeText(text) {
  if (!text) return '';

  try {
    return decodeURIComponent(text);
  } catch (e) {
    return String(text);
  }
}

function formatExpireTime(text) {
  if (!text) return '';

  return String(text);
}

function emptyStore() {
  return {
    version: 1,
    updatedAt: '',
    accounts: {}
  };
}

function loadStore() {
  const raw = $.getdata(STORE_KEY);
  const obj = safeJsonParse(raw, emptyStore());

  if (!obj || typeof obj !== 'object') {
    return emptyStore();
  }

  if (!obj.accounts || typeof obj.accounts !== 'object') {
    obj.accounts = {};
  }

  return obj;
}

function saveStore(store) {
  store.version = 1;
  store.updatedAt = new Date().toLocaleString();
  return $.setdata(JSON.stringify(store), STORE_KEY);
}

function saveLastRecord(record) {
  return $.setdata(JSON.stringify(record), LAST_KEY);
}

function captureAuth() {
  const headers = $request.headers || {};
  const url = $request.url || '';

  const token = getHeaderIgnoreCase(headers, 'x-jlc-accesstoken');
  const secret = getHeaderIgnoreCase(headers, 'secretkey');

  const cookie =
    getHeaderIgnoreCase(headers, 'cookie') ||
    getHeaderIgnoreCase(headers, 'Cookie') ||
    '';

  const ua =
    getHeaderIgnoreCase(headers, 'user-agent') ||
    getHeaderIgnoreCase(headers, 'User-Agent') ||
    DEFAULT_UA;

  const extraHeaders = {
    'x-jlc-mp-appid': getHeaderIgnoreCase(headers, 'x-jlc-mp-appid'),
    'x-jlc-mp-env': getHeaderIgnoreCase(headers, 'x-jlc-mp-env'),
    'x-jlc-mp-version': getHeaderIgnoreCase(headers, 'x-jlc-mp-version'),
    'x-jlc-clienttype': getHeaderIgnoreCase(headers, 'x-jlc-clienttype')
  };

  Object.keys(extraHeaders).forEach(k => {
    if (!extraHeaders[k]) delete extraHeaders[k];
  });

  if (!token || !secret) {
    logBlock('⚠️ 未找到必要 Header', [
      `请求 URL：${shortText(url, 260)}`,
      `x-jlc-accesstoken：${token ? '已找到' : '未找到'}`,
      `secretkey：${secret ? '已找到' : '未找到'}`,
      `Header 数量：${Object.keys(headers).length}`,
      '请确认抓的是 m.jlc.com 小程序接口请求'
    ]);

    return;
  }

  const key = simpleHash(token + '#' + secret);
  const now = new Date().toLocaleString();

  const store = loadStore();
  const old = store.accounts[key];

  const newRecord = {
    key,
    token,
    secret,
    cookie,
    userAgent: ua,
    extraHeaders,
    captureUrl: url,
    updatedAt: old && old.updatedAt ? old.updatedAt : now,
    lastSeenAt: now,
    lastRunAt: old && old.lastRunAt ? old.lastRunAt : '',
    lastResult: old && old.lastResult ? old.lastResult : null,
    total: old && old.total !== undefined ? old.total : null,
    expireTime: old && old.expireTime ? old.expireTime : '',
    remark: old && old.remark ? old.remark : `账号${Object.keys(store.accounts).length + 1}`
  };

  const oldCompare = old ? JSON.stringify({
    token: old.token || '',
    secret: old.secret || '',
    cookie: old.cookie || '',
    userAgent: old.userAgent || '',
    extraHeaders: old.extraHeaders || {}
  }) : '';

  const newCompare = JSON.stringify({
    token,
    secret,
    cookie,
    userAgent: ua,
    extraHeaders
  });

  const changed = oldCompare !== newCompare;

  if (!changed && old) {
    old.lastSeenAt = now;
    old.captureUrl = url;
    store.accounts[key] = old;
    saveStore(store);
    saveLastRecord(old);

    logBlock('⏸ JLC 授权信息未变化', [
      `序列 Key：${key}`,
      `备注：${old.remark || '未知'}`,
      `Token：${maskText(token)}`,
      `Secret：${maskText(secret)}`,
      `Cookie：${cookie ? shortText(maskCookie(cookie), 260) : '无'}`,
      `最后捕获：${now}`
    ]);

    if (NOTIFY_ON_UNCHANGED_CAPTURE) {
      $.msg(SCRIPT_NAME, '授权信息未变化', `账号：${old.remark || key}\n时间：${now}`);
    }

    return;
  }

  newRecord.updatedAt = now;
  store.accounts[key] = newRecord;

  saveStore(store);
  saveLastRecord(newRecord);

  logBlock('✅ JLC 授权信息已保存', [
    `序列 Key：${key}`,
    `备注：${newRecord.remark}`,
    `Token：${maskText(token)}`,
    `Secret：${maskText(secret)}`,
    `Cookie：${cookie ? shortText(maskCookie(cookie), 260) : '无'}`,
    `UA：${shortText(ua, 220)}`,
    `额外 Header：${Object.keys(extraHeaders).length ? JSON.stringify(extraHeaders) : '无'}`,
    `时间：${now}`,
    `本地 Key：${STORE_KEY}`
  ]);

  if (NOTIFY_ON_CAPTURE) {
    $.msg(
      SCRIPT_NAME,
      changed && old ? '授权信息已刷新' : '授权信息已保存',
      `账号：${newRecord.remark}\nKey：${key}\n时间：${now}`
    );
  }
}

function buildHeaders(account) {
  const headers = {
    accept: 'application/json, text/plain, */*',
    'content-type': 'application/json;charset=UTF-8',
    'x-jlc-accesstoken': account.token,
    secretkey: account.secret,
    origin: BASE_URL,
    referer: BASE_URL + '/',
    'user-agent': account.userAgent || DEFAULT_UA
  };

  const extraHeaders = account.extraHeaders || {};
  Object.keys(extraHeaders).forEach(k => {
    if (extraHeaders[k]) headers[k] = extraHeaders[k];
  });

  if (account.cookie) {
    headers.cookie = account.cookie;
  }

  return headers;
}

function buildUrl(path, params = {}) {
  const query = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  return BASE_URL + path + (query ? `?${query}` : '');
}

async function apiGet(account, path, params = {}) {
  const url = buildUrl(path, params);

  return await $.request({
    url,
    method: 'GET',
    headers: buildHeaders(account)
  });
}

async function getSignStatus(account) {
  return await apiGet(account, '/api/activity/sign/getCurrentUserSignInConfig', {
    platformType: PLATFORM_TYPE
  });
}

async function doSignIn(account) {
  return await apiGet(account, '/api/activity/sign/signIn', {
    platformType: PLATFORM_TYPE,
    source: SOURCE
  });
}

async function receiveVoucher(account) {
  return await apiGet(account, '/api/activity/sign/receiveVoucher', {
    platformType: PLATFORM_TYPE
  });
}

async function getDoudouTotal(account) {
  return await apiGet(account, '/api/activity/front/getCustomerIntegral');
}

function formatLine(ok, text) {
  return (ok ? '✅ ' : '❌ ') + text;
}

function extractStreakDay(data) {
  if (!data || typeof data !== 'object') return null;

  const keys = ['day', 'continuousDay', 'continueDay', 'signDay'];

  for (const k of keys) {
    const v = data[k];

    if (typeof v === 'number') return v;
    if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
  }

  return null;
}

async function runOneAccount(index, account) {
  const remark = account.remark || `账号${index}`;

  const result = {
    remark,
    signed: null,
    gain_signin: null,
    gain_day7: null,
    total: null,
    expireTime: null,
    streak_day: null,
    ok: true,
    logs: []
  };

  const logs = result.logs;

  try {
    const st = await getSignStatus(account);

    if (!st || st.success !== true) {
      result.ok = false;
      logs.push(formatLine(false, `[${remark}] 查询签到状态失败：${JSON.stringify(st)}`));
      return result;
    }

    let stData = st.data || {};
    let haveSignIn = stData.haveSignIn === true;
    let haveReceive = stData.haveReceive === true;
    let streakDay = extractStreakDay(stData);

    result.streak_day = streakDay;

    if (streakDay !== null) {
      logs.push(formatLine(true, `[${remark}] 当前连续签到天数：${streakDay} 天`));
    } else {
      logs.push(formatLine(true, `[${remark}] 当前连续签到天数：未知`));
    }

    if (haveSignIn) {
      result.signed = true;
      logs.push(formatLine(true, `[${remark}] 今日已签到`));
    } else {
      const si = await doSignIn(account);

      if (!si || si.success !== true) {
        result.ok = false;
        result.signed = false;
        logs.push(formatLine(false, `[${remark}] 签到失败：${JSON.stringify(si)}`));
      } else {
        const siData = si.data || {};
        const gain = siData.gainNum || 0;

        result.signed = true;
        result.gain_signin = gain;

        logs.push(formatLine(true, `[${remark}] 签到成功，本次获得：${gain} 豆豆`));

        const st2 = await getSignStatus(account);

        if (st2 && st2.success === true) {
          stData = st2.data || {};
          haveSignIn = stData.haveSignIn === true;
          haveReceive = stData.haveReceive === true;
          streakDay = extractStreakDay(stData);
          result.streak_day = streakDay;
        }
      }
    }

    if (streakDay === 7 && haveSignIn && !haveReceive) {
      logs.push(formatLine(true, `[${remark}] 检测到连续签到第 7 天且未领取，开始领取 8 豆豆...`));

      const rv = await receiveVoucher(account);

      if (!rv || rv.success !== true) {
        result.ok = false;
        logs.push(formatLine(false, `[${remark}] 第七天领取失败：${JSON.stringify(rv)}`));
      } else {
        const got = rv.data;

        result.gain_day7 = got;
        logs.push(formatLine(true, `[${remark}] 第七天领取成功：+${got} 豆豆`));

        const st3 = await getSignStatus(account);
        if (st3 && st3.success === true && st3.data && st3.data.haveReceive === true) {
          logs.push(formatLine(true, `[${remark}] 领取状态已更新：haveReceive=True`));
        }
      }
    } else if (streakDay === 7 && haveSignIn && haveReceive) {
      logs.push(formatLine(true, `[${remark}] 连续签到第 7 天奖励已领取，无需重复领取`));
    }

    const ct = await getDoudouTotal(account);

    if (!ct || ct.success !== true) {
      result.ok = false;
      logs.push(formatLine(false, `[${remark}] 查询豆豆总数失败：${JSON.stringify(ct)}`));
    } else {
      const data = ct.data || {};
      const total = data.integralVoucher;
      const expireTime = data.expireTime;

      result.total = total;
      result.expireTime = expireTime || '';

      const extra = expireTime ? `，有效期至：${expireTime}` : '';
      logs.push(formatLine(true, `[${remark}] 当前豆豆总数：${total}${extra}`));
    }

    return result;
  } catch (e) {
    result.ok = false;
    logs.push(formatLine(false, `[${remark}] 执行异常：${e && e.message ? e.message : String(e)}`));
    return result;
  }
}

function buildAccountList(store) {
  return Object.keys(store.accounts || {})
    .map(key => store.accounts[key])
    .filter(x => x && x.token && x.secret)
    .sort((a, b) => {
      const ta = new Date(a.updatedAt || a.lastSeenAt || 0).getTime() || 0;
      const tb = new Date(b.updatedAt || b.lastSeenAt || 0).getTime() || 0;
      return tb - ta;
    });
}

async function runTask() {
  const store = loadStore();
  const accounts = buildAccountList(store);

  if (!accounts.length) {
    const msg = [
      '❌ 未找到本地授权信息',
      `本地 Key：${STORE_KEY}`,
      '',
      '请先打开嘉立创小程序，让 QX 抓取 m.jlc.com 请求中的 x-jlc-accesstoken 和 secretkey。'
    ].join('\n');

    console.log(msg);
    $.msg(SCRIPT_NAME, '未找到授权信息', msg);
    return;
  }

  const allLogs = [];
  const pushLines = [];
  let anyFail = false;

  allLogs.push('============ 嘉立创 签到 ============');
  allLogs.push(`账号数量：${accounts.length}`);
  allLogs.push('---------------------------------');

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const result = await runOneAccount(i + 1, account);

    allLogs.push(result.logs.join('\n'));
    allLogs.push('---------------------------------');

    const key = account.key;

    if (store.accounts[key]) {
      store.accounts[key].lastRunAt = new Date().toLocaleString();
      store.accounts[key].lastResult = result;
      store.accounts[key].total = result.total;
      store.accounts[key].expireTime = result.expireTime || '';
    }

    if (result.ok) {
      const gainedParts = [];

      if (result.gain_signin !== null && result.gain_signin !== undefined) {
        gainedParts.push(`+${result.gain_signin}`);
      }

      if (result.gain_day7 !== null && result.gain_day7 !== undefined) {
        gainedParts.push(`+${result.gain_day7}(第7天)`);
      }

      if (gainedParts.length) {
        pushLines.push(`${result.remark}：${gainedParts.join(' ')}；\n总豆豆 ${result.total}`);
      } else {
        pushLines.push(`${result.remark}：已签到/无需重复；\n总豆豆 ${result.total}`);
      }
    } else {
      anyFail = true;
      pushLines.push(`${result.remark}：失败（看日志）`);
    }
  }

  saveStore(store);

  const finalLog = allLogs.join('\n');
  console.log(finalLog);

  $.setdata(JSON.stringify({
    time: new Date().toLocaleString(),
    anyFail,
    pushLines
  }), LAST_RESULT_KEY);

  $.msg(
    SCRIPT_NAME,
    anyFail ? '部分失败' : '签到完成',
    pushLines.join('\n\n')
  );
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

    request(options) {
      return new Promise((resolve, reject) => {
        if (typeof $task === 'undefined' || !$task.fetch) {
          reject(new Error('当前环境不支持 $task.fetch，请在 Quantumult X 中运行'));
          return;
        }

        const opt = {
          url: options.url,
          method: String(options.method || 'GET').toUpperCase(),
          headers: options.headers || {}
        };

        if (options.body) {
          opt.body = options.body;
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