// 2026/05/06
/*
项目: 大潮
名称: 查询本地 member
用途: 查询 Quantumult X 本地保存的 member 数据。

特点：
1. 不显示历史数量
2. 自动清理旧版本遗留的 history 字段
3. expire 时间戳显示为可读时间

QX task 示例：
0 9 * * * DCTX_Member_Query_QX.js, tag=大潮member查询, enabled=false
*/

const SCRIPT_NAME = '大潮 member 查询';
const STORE_KEY = 'dctx_member_store_v1';

// 留空查询全部；填写手机号 / ID / key 只查询指定账号。
const QUERY_TARGETS = [
  // '13800138000',
  // '271f08ce5f779e87248592165e88523c',
];

// 是否显示完整 member。敏感信息，默认关闭。
const SHOW_FULL_MEMBER = false;

// 是否自动清理旧版本 history 字段。
const AUTO_CLEAN_HISTORY = true;

// 通知中 member 最大显示长度
const MAX_MEMBER_PREVIEW_LEN = SHOW_FULL_MEMBER ? 3000 : 260;

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
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

function shortText(text, maxLen) {
  if (!text) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}

function maskMemberText(text) {
  if (!text) return '';

  if (SHOW_FULL_MEMBER) {
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
    .replace(/("member"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("raw"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("phone"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("mobile"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("password"\s*:\s*")[^"]+/gi, '$1***');
}

function decodeText(text) {
  if (!text) return '';

  try {
    return decodeURIComponent(text);
  } catch (e) {
    return String(text);
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

  // 兼容秒级 / 毫秒级时间戳
  const ms = n < 10000000000 ? n * 1000 : n;
  const d = new Date(ms);

  if (isNaN(d.getTime())) {
    return String(expire);
  }

  const p = x => String(x).padStart(2, '0');

  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function loadStore() {
  const raw = $prefs.valueForKey(STORE_KEY);
  const obj = safeJsonParse(raw, {
    version: 1,
    updatedAt: '',
    accounts: {}
  });

  if (!obj || typeof obj !== 'object') {
    return {
      version: 1,
      updatedAt: '',
      accounts: {}
    };
  }

  if (!obj.accounts || typeof obj.accounts !== 'object') {
    obj.accounts = {};
  }

  return obj;
}

function saveStore(store) {
  store.version = 1;
  store.updatedAt = new Date().toLocaleString();
  return $prefs.setValueForKey(JSON.stringify(store), STORE_KEY);
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

  if (count > 0 && AUTO_CLEAN_HISTORY) {
    saveStore(store);
  }

  return count;
}

function matchRecord(rec, targets) {
  if (!targets || targets.length === 0) {
    return true;
  }

  const parsed = safeJsonParse(rec.raw, {});

  const values = [
    rec.key,
    rec.phone,
    rec.mobile,
    rec.id,
    parsed.id,
    parsed.phone,
    parsed.mobile
  ].map(v => String(v || '').trim());

  return targets.some(t => values.includes(String(t || '').trim()));
}

function getRecordExpire(rec, parsed) {
  return rec.expire || parsed.expire || '';
}

function getRecordNickname(rec, parsed) {
  return decodeText(
    rec.nickname ||
    parsed.nick_name ||
    parsed.nickname ||
    parsed.nickName ||
    parsed.name ||
    ''
  );
}

function getRecordSource(rec, parsed) {
  return rec.source || parsed.source || '未知';
}

function getRecordId(rec, parsed) {
  return rec.id || parsed.id || parsed.account_id || parsed.accountId || '未知';
}

function main() {
  if (typeof $prefs === 'undefined') {
    const msg = '当前环境不支持 $prefs，请在 Quantumult X 中运行';
    console.log(`❌ ${msg}`);

    if (typeof $notify !== 'undefined') {
      $notify('🌟 大潮 member 查询', '环境错误', msg);
    }

    if (typeof $done !== 'undefined') $done({});
    return;
  }

  const store = loadStore();
  const cleanedHistoryCount = cleanupLegacyHistory(store);

  const list = Object.keys(store.accounts || {})
    .map(k => store.accounts[k])
    .filter(Boolean);

  const targets = QUERY_TARGETS
    .map(v => String(v).trim())
    .filter(Boolean);

  const selected = list.filter(rec => matchRecord(rec, targets));

  if (selected.length === 0) {
    const msg = list.length === 0
      ? `未找到本地 member\n本地 Key：${STORE_KEY}`
      : `未匹配到指定账号\n当前已保存：${list.map(x => maskPhone(x.key)).join('、')}`;

    console.log(`\n【${SCRIPT_NAME}】${msg}`);
    $notify('🌟 大潮 member 查询', '未找到记录', msg);
    $done({});
    return;
  }

  const blocks = selected.map((rec, idx) => {
    const parsed = safeJsonParse(rec.raw, {});
    const expireRaw = getRecordExpire(rec, parsed);
    const expireText = expireRaw
      ? `${formatExpire(expireRaw)} (${expireRaw})`
      : '未知';

    return [
      `【${idx + 1}】账号：${maskPhone(rec.key)}`,
      `ID：${getRecordId(rec, parsed)}`,
      `昵称：${getRecordNickname(rec, parsed) || '未知'}`,
      `来源：${getRecordSource(rec, parsed)}`,
      `过期：${expireText}`,
      `更新时间：${rec.updatedAt || '未知'}`,
      `member：${shortText(maskMemberText(rec.raw), MAX_MEMBER_PREVIEW_LEN)}`
    ].join('\n');
  });

  const output = [
    blocks.join('\n\n------------------------------\n\n'),
    cleanedHistoryCount ? `\n已自动清理旧 history 字段：${cleanedHistoryCount} 个` : ''
  ].filter(Boolean).join('\n');

  console.log(`\n【${SCRIPT_NAME}】\n${output}`);

  $notify(
    '🌟 大潮 member 查询',
    `共 ${selected.length} 个账号`,
    output
  );

  $done({});
}

try {
  main();
} catch (e) {
  const err = e && e.message ? e.message : String(e);
  console.log(`【${SCRIPT_NAME}】脚本异常：${err}`);

  if (typeof $notify !== 'undefined') {
    $notify('🌟 大潮 member 查询', '脚本异常', err);
  }

  if (typeof $done !== 'undefined') {
    $done({});
  }
}
