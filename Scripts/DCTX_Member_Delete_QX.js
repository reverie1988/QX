// 2026/05/06
/*
项目: 大潮
名称: 删除本地 member
用途: 按序列号删除 Quantumult X 本地保存的 member。

特点：
1. 使用序列号删除，更直观
2. 支持删除多个序列号
3. 支持删除全部
4. DELETE_INDEXES 留空时只列出当前账号，不删除

QX task 示例：
0 9 * * * DCTX_Member_Delete_QX.js, tag=大潮member删除, enabled=false
*/

const SCRIPT_NAME = '大潮 member 删除';
const STORE_KEY = 'dctx_member_store_v1';
const LAST_KEY = 'dctx_member_last_v1';

// 在这里填写要删除的序列号。
// 例如删除第 1 个和第 3 个：
// const DELETE_INDEXES = [1, 3];
//
// 留空时只列出当前已保存账号，不删除。
const DELETE_INDEXES = [
  // 1,
];

// 删除全部请改成 true。优先级高于 DELETE_INDEXES。
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

function getRecordId(rec) {
  const parsed = safeJsonParse(rec && rec.raw, {});
  return rec.id || parsed.id || parsed.account_id || parsed.accountId || '未知';
}

function getRecordExpire(rec) {
  const parsed = safeJsonParse(rec && rec.raw, {});
  return rec.expire || parsed.expire || '';
}

function getRecordName(rec) {
  const parsed = safeJsonParse(rec && rec.raw, {});
  const raw = rec.nickname || parsed.nick_name || parsed.nickname || parsed.nickName || parsed.name || '';

  if (!raw) return '未知';

  try {
    return decodeURIComponent(raw);
  } catch (e) {
    return String(raw);
  }
}

function buildList(store) {
  return Object.keys(store.accounts || {})
    .map(key => ({
      key,
      rec: store.accounts[key]
    }))
    .filter(x => x.rec)
    .sort((a, b) => {
      const ta = new Date(a.rec.updatedAt || 0).getTime() || 0;
      const tb = new Date(b.rec.updatedAt || 0).getTime() || 0;
      return tb - ta;
    });
}

function getValidDeleteIndexes(max) {
  const set = new Set();

  for (const x of DELETE_INDEXES) {
    const n = Number(x);

    if (Number.isInteger(n) && n >= 1 && n <= max) {
      set.add(n);
    }
  }

  return Array.from(set).sort((a, b) => a - b);
}

function updateLastKey(store) {
  const remainKeys = Object.keys(store.accounts || {});

  if (remainKeys.length === 0) {
    $prefs.removeValueForKey(LAST_KEY);
    return;
  }

  const list = buildList(store);
  const first = list[0] && list[0].rec;
  const firstKey = list[0] && list[0].key;

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

function renderAccountList(list) {
  return list.map((item, idx) => {
    const rec = item.rec;
    const expireRaw = getRecordExpire(rec);

    return [
      `${idx + 1}. 账号：${maskPhone(rec.key || item.key)}`,
      `   ID：${getRecordId(rec)}`,
      `   昵称：${getRecordName(rec)}`,
      `   过期：${expireRaw ? `${formatExpire(expireRaw)} (${expireRaw})` : '未知'}`,
      `   更新时间：${rec.updatedAt || '未知'}`
    ].join('\n');
  }).join('\n\n');
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
  const list = buildList(store);

  if (list.length === 0) {
    const msg = `当前没有本地 member 记录\n本地 Key：${STORE_KEY}`;

    console.log(`\n【${SCRIPT_NAME}】${msg}`);
    $notify('🌟 大潮 member 删除', '无记录', msg);
    $done({});
    return;
  }

  if (!DELETE_ALL && DELETE_INDEXES.length === 0) {
    const msg = [
      '未填写 DELETE_INDEXES，本次不会删除。',
      '',
      '当前可删除账号：',
      renderAccountList(list),
      '',
      '需要删除哪个账号，就把上面的序列号填进 DELETE_INDEXES。',
      '例如删除第 1 个：const DELETE_INDEXES = [1];',
      '例如删除第 1 和第 3 个：const DELETE_INDEXES = [1, 3];'
    ].join('\n');

    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $notify('🌟 大潮 member 删除', '请选择序列号', msg);
    $done({});
    return;
  }

  let deleteIndexes = [];

  if (DELETE_ALL) {
    deleteIndexes = list.map((_, idx) => idx + 1);
  } else {
    deleteIndexes = getValidDeleteIndexes(list.length);
  }

  if (!deleteIndexes.length) {
    const msg = [
      `DELETE_INDEXES 无有效序列号：${JSON.stringify(DELETE_INDEXES)}`,
      '',
      `有效范围：1 - ${list.length}`,
      '',
      '当前可删除账号：',
      renderAccountList(list)
    ].join('\n');

    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $notify('🌟 大潮 member 删除', '序列号无效', msg);
    $done({});
    return;
  }

  const deleted = [];

  for (const index of deleteIndexes) {
    const item = list[index - 1];

    if (!item || !item.rec) continue;

    deleted.push({
      index,
      key: item.key,
      account: item.rec.key || item.key,
      id: getRecordId(item.rec),
      name: getRecordName(item.rec)
    });

    delete store.accounts[item.key];
  }

  saveStore(store);
  updateLastKey(store);

  const remainList = buildList(store);

  const msg = [
    `已删除 ${deleted.length} 个账号 member：`,
    ...deleted.map(x => `${x.index}. ${maskPhone(x.account)} / ID: ${x.id} / 昵称: ${x.name}`),
    '',
    `剩余：${remainList.length} 个`,
    remainList.length ? '\n当前剩余账号：\n' + renderAccountList(remainList) : ''
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