// 2026/05/05
/*
@Name：GLaDOS 浏览器 Cookie 提取器
@Description：
- 从 Safari / Edge / Chrome 访问 glados.cloud 时自动提取 Cookie
- 保存到 QX 本地 $prefs
- 支持从 /api/user/status 响应中补充邮箱和剩余天数

推荐 Rewrite snippet：

hostname = glados.cloud

^https:\/\/glados\.cloud\/api\/user\/status url script-response-body https://raw.githubusercontent.com/reverie1988/QX/main/Scripts/GLaDOS_Capture.js
^https:\/\/glados\.cloud\/(console|api\/user\/checkin|api\/user\/points|api\/user\/exchange) url script-request-header https://raw.githubusercontent.com/reverie1988/QX/main/Scripts/GLaDOS_Capture.js
*/

const SCRIPT_NAME = 'GLaDOS';
const STORE_KEY = 'glados_accounts_v1';

const SHOW_COOKIE_IN_LOG = false;

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

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function getHeaderIgnoreCase(headers, name) {
  if (!headers) return '';
  const target = String(name).toLowerCase();

  for (const k in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, k)) {
      if (String(k).toLowerCase() === target) {
        return headers[k];
      }
    }
  }

  return '';
}

function shortText(text, maxLen) {
  if (!text) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}

function maskCookie(cookie) {
  if (!cookie) return '';
  if (SHOW_COOKIE_IN_LOG) return String(cookie);

  return String(cookie)
    .replace(/(koa:sess=)[^;]+/gi, '$1***')
    .replace(/(koa:sess\.sig=)[^;]+/gi, '$1***')
    .replace(/(token=)[^;]+/gi, '$1***')
    .replace(/(session=)[^;]+/gi, '$1***');
}

function simpleHash(str) {
  str = String(str || '');
  let h = 2166136261;

  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }

  return ('00000000' + (h >>> 0).toString(16)).slice(-8);
}

function loadStore() {
  const raw = $prefs.valueForKey(STORE_KEY);

  if (!raw) {
    return {
      version: 1,
      accounts: {},
      order: []
    };
  }

  const store = safeJsonParse(raw);

  if (!store) {
    return {
      version: 1,
      accounts: {},
      order: []
    };
  }

  if (!store.accounts) store.accounts = {};
  if (!Array.isArray(store.order)) store.order = Object.keys(store.accounts);

  return store;
}

function saveStore(store) {
  $prefs.setValueForKey(JSON.stringify(store), STORE_KEY);
}

function parseStatusFromResponseBody(body) {
  const json = safeJsonParse(body);

  if (!json || !json.data) {
    return {};
  }

  const data = json.data;

  return {
    email: data.email || '',
    leftDays: data.leftDays,
    userId: data.id || data.userId || '',
    plan: data.plan || ''
  };
}

function findSameCookieAccountId(store, cookie) {
  const ids = store.order || [];

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const acc = store.accounts[id];

    if (acc && acc.cookie === cookie) {
      return id;
    }
  }

  return '';
}

function saveAccount(cookie, info) {
  const store = loadStore();
  const now = Date.now();

  const email = info.email ? String(info.email).trim().toLowerCase() : '';
  const fallbackId = 'ck_' + simpleHash(cookie);
  const sameCookieOldId = findSameCookieAccountId(store, cookie);

  const accountId = email || sameCookieOldId || fallbackId;
  const existed = !!store.accounts[accountId];

  if (sameCookieOldId && sameCookieOldId !== accountId) {
    delete store.accounts[sameCookieOldId];
    store.order = store.order.filter(id => id !== sameCookieOldId);
  }

  const old = store.accounts[accountId] || {};

  const changed =
    !old.cookie ||
    old.cookie !== cookie ||
    old.email !== email ||
    String(old.leftDays || '') !== String(info.leftDays || '');

  store.accounts[accountId] = {
    id: accountId,
    email: email || old.email || '',
    alias: old.alias || email || accountId,
    cookie: cookie,
    cookiePreview: maskCookie(cookie),
    userId: info.userId || old.userId || '',
    leftDays: info.leftDays !== undefined ? info.leftDays : old.leftDays,
    plan: info.plan || old.plan || '',
    createdAt: old.createdAt || now,
    updatedAt: now
  };

  if (store.order.indexOf(accountId) < 0) {
    store.order.push(accountId);
  }

  saveStore(store);

  return {
    id: accountId,
    account: store.accounts[accountId],
    total: store.order.length,
    changed: changed,
    existed: existed
  };
}

function finish() {
  if (typeof $response !== 'undefined' && $response && typeof $response.body !== 'undefined') {
    $done({ body: $response.body });
  } else {
    $done({});
  }
}

function main() {
  if (typeof $request === 'undefined' || !$request || !$request.headers) {
    logBlock('❌ 环境错误', [
      '没有检测到 $request.headers',
      '请确认使用 script-request-header 或 script-response-body'
    ]);
    finish();
    return;
  }

  const headers = $request.headers;
  const cookie = getHeaderIgnoreCase(headers, 'Cookie');

  if (!cookie) {
    logBlock('⚠️ 未找到 Cookie', [
      `URL：${shortText($request.url || '未知', 260)}`
    ]);
    finish();
    return;
  }

  if (cookie.indexOf('koa:sess=') === -1 || cookie.indexOf('koa:sess.sig=') === -1) {
    logBlock('⚠️ Cookie 不完整', [
      '未检测到 koa:sess 或 koa:sess.sig',
      `Cookie：${shortText(maskCookie(cookie), 220)}`
    ]);
    finish();
    return;
  }

  let info = {};

  if (typeof $response !== 'undefined' && $response && $response.body) {
    info = parseStatusFromResponseBody($response.body);
  }

  const saved = saveAccount(cookie, info);
  const acc = saved.account;

  logBlock(saved.changed ? '✅ GLaDOS 账号已保存' : '⏸ GLaDOS 账号无变化', [
    `账号 ID：${saved.id}`,
    `邮箱：${acc.email || '未获取，稍后运行查看脚本可查询'}`,
    `剩余天数：${acc.leftDays !== undefined ? acc.leftDays : '未获取'}`,
    `当前账号数：${saved.total}`,
    `存储 Key：${STORE_KEY}`,
    `Cookie：${shortText(maskCookie(cookie), 220)}`
  ]);

  if (saved.changed) {
    $notify(
      SCRIPT_NAME,
      saved.existed ? '🔄 账号信息已更新' : '✅ 新账号已保存',
      `${acc.email || saved.id}\n当前账号数：${saved.total}`
    );
  }

  finish();
}

try {
  main();
} catch (e) {
  logBlock('❌ 脚本异常', [
    `错误：${e && e.message ? e.message : String(e)}`
  ]);
  finish();
}