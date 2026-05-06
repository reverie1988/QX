// 2026/05/06
/*
项目: 大潮
名称: member 本地存储器
用途: 从请求头提取 member，仅保存到 Quantumult X 本地 $prefs，不负责提现/领取。

特点：
1. 不保存旧数据
2. 不保存 history
3. 每次获取 member 都直接更新本地数据
4. 自动清理旧版本遗留的 history 字段

QX rewrite 示例：
hostname = m.aihoge.com
^https:\/\/m\.aihoge\.com\/api\/publichy\/client\/activity\/info\?source=wechat url script-request-header DCTX_Member_Store_QX.js
*/

const SCRIPT_NAME = '大潮 member 本地存储器';
const STORE_KEY = 'dctx_member_store_v1';
const LAST_KEY = 'dctx_member_last_v1';

// 是否在日志/通知中显示完整 member。member 属于敏感信息，默认关闭。
const SHOW_FULL_MEMBER_IN_LOG = false;

// 是否在通知里放复制内容。默认关闭，避免误复制/泄露完整 member。
const COPY_MEMBER_IN_NOTIFY = false;

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

function maskPhone(phone) {
  const s = String(phone || '');

  if (/^\d{11}$/.test(s)) {
    return s.slice(0, 3) + '****' + s.slice(7);
  }

  if (s.length > 6) {
    return s.slice(0, 3) + '****' + s.slice(-3);
  }

  return s || '未知';
}

function maskMemberText(text) {
  if (!text) return '';

  if (SHOW_FULL_MEMBER_IN_LOG) {
    return String(text);
  }

  return String(text)
    .replace(/("token"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("access_token"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("auth"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("authorization"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("btoken"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("mtoken"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("stoken"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("phone"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("mobile"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("password"\s*:\s*")[^"]+/gi, '$1***');
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

function normalizeKey(value) {
  return String(value || '').trim();
}

function getAccountKey(parsed) {
  return normalizeKey(
    parsed.mobile ||
    parsed.phone ||
    parsed.phone_number ||
    parsed.account ||
    parsed.account_id ||
    parsed.accountId ||
    parsed.id
  );
}

function getMemberId(parsed) {
  return normalizeKey(parsed.id || parsed.account_id || parsed.accountId);
}

function getNickname(parsed) {
  const raw =
    parsed.nickname ||
    parsed.nickName ||
    parsed.nick_name ||
    parsed.name ||
    '';

  try {
    return decodeURIComponent(raw);
  } catch (e) {
    return raw;
  }
}

function formatExpire(expire) {
  if (expire === undefined || expire === null || expire === '') {
    return '未知';
  }

  const n = Number(expire);

  if (!n || isNaN(n)) {
    return String(expire);
  }

  const ms = n < 10000000000 ? n * 1000 : n;
  const d = new Date(ms);

  if (isNaN(d.getTime())) {
    return String(expire);
  }

  const p = x => String(x).padStart(2, '0');

  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function emptyStore() {
  return {
    version: 1,
    updatedAt: '',
    accounts: {}
  };
}

function loadStore() {
  const raw = $prefs.valueForKey(STORE_KEY);
  const obj = safeJsonParse(raw, emptyStore());

  if (!obj || typeof obj !== 'object') {
    return emptyStore();
  }

  if (!obj.accounts || typeof obj.accounts !== 'object') {
    obj.accounts = {};
  }

  return obj;
}

function cleanupLegacyHistory(store) {
  if (!store || !store.accounts) return 0;

  let count = 0;

  for (const key of Object.keys(store.accounts)) {
    const rec = store.accounts[key];

    if (rec && Object.prototype.hasOwnProperty.call(rec, 'history')) {
      delete rec.history;
      count++;
    }
  }

  return count;
}

function cleanupDuplicateById(store, currentKey, currentId) {
  if (!store || !store.accounts || !currentId) return 0;

  let count = 0;

  for (const key of Object.keys(store.accounts)) {
    if (key === currentKey) continue;

    const rec = store.accounts[key];
    if (!rec) continue;

    const parsed = safeJsonParse(rec.raw, {});
    const recId = normalizeKey(rec.id || parsed.id || parsed.account_id || parsed.accountId);

    if (recId && recId === currentId) {
      delete store.accounts[key];
      count++;
    }
  }

  return count;
}

function saveStore(store) {
  store.version = 1;
  store.updatedAt = new Date().toLocaleString();
  return $prefs.setValueForKey(JSON.stringify(store), STORE_KEY);
}

function notify(title, subtitle, body, copyText) {
  const option = {
    'media-url': 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f465.png'
  };

  if (copyText) {
    option['update-pasteboard'] = copyText;
  }

  $notify(title, subtitle, body, option);
}

function extractMember() {
  if (typeof $request === 'undefined' || !$request || !$request.headers) {
    logBlock('❌ 环境错误', [
      '原因：没有检测到 $request.headers',
      '请确认使用 script-request-header，而不是 task/cron'
    ]);
    return;
  }

  const headers = $request.headers;
  const memberValue = getHeaderIgnoreCase(headers, 'member');

  if (!memberValue || typeof memberValue !== 'string' || memberValue.trim() === '') {
    logBlock('⚠️ 未找到 member 请求头', [
      `请求 URL：${shortText($request.url || '未知', 260)}`,
      `Header 数量：${Object.keys(headers).length}`
    ]);
    return;
  }

  const parsedData = safeJsonParse(memberValue);

  if (!parsedData) {
    logBlock('❌ member 不是有效 JSON', [
      `member 预览：${shortText(maskMemberText(memberValue), 300)}`
    ]);

    notify(
      '🌟 member',
      '❌ JSON 解析失败',
      shortText(maskMemberText(memberValue), 300),
      COPY_MEMBER_IN_NOTIFY ? memberValue : ''
    );

    return;
  }

  const accountKey = getAccountKey(parsedData);
  const memberId = getMemberId(parsedData);

  if (!accountKey) {
    logBlock('❌ 无法识别账号', [
      'member 中未找到 mobile/phone/account_id/id 字段',
      `member 预览：${shortText(maskMemberText(memberValue), 300)}`
    ]);

    notify(
      '🌟 member',
      '❌ 未识别账号',
      'member 中缺少 mobile/phone/id，未保存',
      ''
    );

    return;
  }

  const store = loadStore();

  const cleanedHistoryCount = cleanupLegacyHistory(store);
  const cleanedDuplicateCount = cleanupDuplicateById(store, accountKey, memberId);

  const now = new Date().toLocaleString();

  // 每次获取都直接覆盖，不保存旧数据、不保存 history、不跳过相同数据
  store.accounts[accountKey] = {
    key: accountKey,
    phone: parsedData.phone || parsedData.mobile || '',
    mobile: parsedData.mobile || parsedData.phone || '',
    id: memberId,
    nickname: getNickname(parsedData),
    source: parsedData.source || '',
    expire: parsedData.expire || '',
    updatedAt: now,
    raw: memberValue
  };

  saveStore(store);

  // 最后一次抓取记录，也直接覆盖
  $prefs.setValueForKey(
    JSON.stringify({
      key: accountKey,
      id: memberId,
      phone: parsedData.phone || parsedData.mobile || '',
      mobile: parsedData.mobile || parsedData.phone || '',
      nickname: getNickname(parsedData),
      source: parsedData.source || '',
      expire: parsedData.expire || '',
      updatedAt: now,
      raw: memberValue
    }),
    LAST_KEY
  );

  logBlock('✅ member 已更新到本地', [
    `账号：${maskPhone(accountKey)}`,
    `ID：${memberId || '未知'}`,
    `昵称：${getNickname(parsedData) || '未知'}`,
    `来源：${parsedData.source || '未知'}`,
    `过期：${formatExpire(parsedData.expire)}${parsedData.expire ? ` (${parsedData.expire})` : ''}`,
    `时间：${now}`,
    `本地 Key：${STORE_KEY}`,
    '保存方式：直接覆盖，不保存旧数据',
    cleanedHistoryCount ? `已清理旧 history 字段：${cleanedHistoryCount} 个` : '',
    cleanedDuplicateCount ? `已清理重复账号记录：${cleanedDuplicateCount} 个` : '',
    `member 预览：${shortText(maskMemberText(memberValue), 300)}`
  ]);

  notify(
    '🌟 member 已更新',
    `账号: ${maskPhone(accountKey)}`,
    `ID: ${memberId || '未知'}\n时间: ${now}`,
    COPY_MEMBER_IN_NOTIFY ? memberValue : ''
  );
}

try {
  extractMember();
} catch (e) {
  logBlock('❌ 脚本异常', [
    `错误：${e && e.message ? e.message : String(e)}`
  ]);
}

$done({});