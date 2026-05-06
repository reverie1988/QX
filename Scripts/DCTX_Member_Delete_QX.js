// 2026/05/06
/*
项目: 大潮
名称: 删除本地 member
用途: 按账号删除 Quantumult X 本地保存的 member。

特点：
1. 可按手机号 / ID / key 删除
2. 可删除全部
3. 留空时只列出当前账号，不删除

QX task 示例：
0 9 * * * DCTX_Member_Delete_QX.js, tag=大潮member删除, enabled=false
*/

const SCRIPT_NAME = '大潮 member 删除';
const STORE_KEY = 'dctx_member_store_v1';
const LAST_KEY = 'dctx_member_last_v1';

// 在这里填写要删除的账号，可填手机号、ID、key。
// 留空时只列出当前已保存账号，不删除。
const DELETE_TARGETS = [
  // '13800138000',
  // '1293d527550bb307ea8c6edc5f90ef76',
];

// 删除全部请改成 true。优先级高于 DELETE_TARGETS。
const DELETE_ALL = false;

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

function recordValues(key, rec) {
  const parsed = safeJsonParse(rec && rec.raw, {});

  return [
    key,
    rec && rec.key,
    rec && rec.phone,
    rec && rec.mobile,
    rec && rec.id,
    parsed.id,
    parsed.phone,
    parsed.mobile,
    parsed.account_id,
    parsed.accountId
  ].map(v => String(v || '').trim()).filter(Boolean);
}

function getRecordId(rec) {
  const parsed = safeJsonParse(rec && rec.raw, {});
  return rec.id || parsed.id || parsed.account_id || parsed.accountId || '未知';
}

function getRecordExpire(rec) {
  const parsed = safeJsonParse(rec && rec.raw, {});
  return rec.expire || parsed.expire || '';
}

function main() {
  if (typeof $prefs === 'undefined') {
    const msg = '当前环境不支持 $prefs，请在 Quantumult X 中运行';
    console.log(`❌ ${msg}`);

    if (typeof $notify !== 'undefined') {
      $notify('🌟 大潮 member 删除', '环境错误', msg);
    }

    if (typeof $done !== 'undefined') $done({});
    return;
  }

  const store = loadStore();
  const keys = Object.keys(store.accounts || {});
  const list = keys.map(k => ({
    key: k,
    rec: store.accounts[k]
  })).filter(x => x.rec);

  if (list.length === 0) {
    const msg = `当前没有本地 member 记录\n本地 Key：${STORE_KEY}`;

    console.log(`\n【${SCRIPT_NAME}】${msg}`);
    $notify('🌟 大潮 member 删除', '无记录', msg);
    $done({});
    return;
  }

  const targets = DELETE_TARGETS
    .map(v => String(v).trim())
    .filter(Boolean);

  if (!DELETE_ALL && targets.length === 0) {
    const msg = [
      '未填写 DELETE_TARGETS，本次不会删除。',
      '',
      '当前可删除账号：',
      ...list.map((item, idx) => {
        const expireRaw = getRecordExpire(item.rec);
        return [
          `${idx + 1}. 账号：${maskPhone(item.rec.key || item.key)}`,
          `   ID：${getRecordId(item.rec)}`,
          `   过期：${expireRaw ? `${formatExpire(expireRaw)} (${expireRaw})` : '未知'}`,
          `   更新时间：${item.rec.updatedAt || '未知'}`
        ].join('\n');
      }),
      '',
      '需要删除哪个账号，就把手机号或 ID 填进 DELETE_TARGETS。'
    ].join('\n');

    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $notify('🌟 大潮 member 删除', '请选择账号', msg);
    $done({});
    return;
  }

  const deleted = [];

  for (const item of list) {
    const key = item.key;
    const rec = item.rec;

    const values = recordValues(key, rec);

    const shouldDelete = DELETE_ALL || targets.some(t => values.includes(t));

    if (shouldDelete) {
      deleted.push({
        key,
        account: rec.key || key,
        id: getRecordId(rec)
      });

      delete store.accounts[key];
    }
  }

  if (deleted.length === 0) {
    const msg = [
      `未匹配到要删除的账号：${targets.join('、')}`,
      '',
      '当前已保存账号：',
      ...list.map((item, idx) => `${idx + 1}. ${maskPhone(item.rec.key || item.key)} / ID: ${getRecordId(item.rec)}`)
    ].join('\n');

    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $notify('🌟 大潮 member 删除', '未匹配到账号', msg);
    $done({});
    return;
  }

  saveStore(store);

  const remainKeys = Object.keys(store.accounts || {});

  if (remainKeys.length === 0) {
    $prefs.removeValueForKey(LAST_KEY);
  } else {
    const firstKey = remainKeys[0];
    const first = store.accounts[firstKey];

    if (first && first.raw) {
      $prefs.setValueForKey(
        JSON.stringify({
          key: first.key || firstKey,
          id: first.id || '',
          phone: first.phone || '',
          mobile: first.mobile || '',
          nickname: first.nickname || '',
          source: first.source || '',
          expire: first.expire || '',
          updatedAt: first.updatedAt || '',
          raw: first.raw
        }),
        LAST_KEY
      );
    }
  }

  const msg = [
    `已删除 ${deleted.length} 个账号 member：`,
    ...deleted.map(x => `${maskPhone(x.account)} / ID: ${x.id}`),
    '',
    `剩余：${remainKeys.length} 个`
  ].join('\n');

  console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
  $notify('🌟 大潮 member 删除', `已删除 ${deleted.length} 个`, msg);

  $done({});
}

try {
  main();
} catch (e) {
  const err = e && e.message ? e.message : String(e);
  console.log(`【${SCRIPT_NAME}】脚本异常：${err}`);

  if (typeof $notify !== 'undefined') {
    $notify('🌟 大潮 member 删除', '脚本异常', err);
  }

  if (typeof $done !== 'undefined') {
    $done({});
  }
}