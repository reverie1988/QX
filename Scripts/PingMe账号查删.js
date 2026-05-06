// 2026/05/06
/*
项目: PingMe
名称: PingMe 本地账号管理
用途:
1. 查询 QX 本地保存的 PingMe 账号
2. 按序列号删除指定账号
3. 支持删除全部

本地 Key:
pingme_accounts_v1

使用方式:
查询:
const ACTION = 'query';

删除第 1 个:
const ACTION = 'delete';
const DELETE_INDEXES = [1];

删除第 1 和第 3 个:
const ACTION = 'delete';
const DELETE_INDEXES = [1, 3];

删除全部:
const ACTION = 'delete';
const DELETE_ALL = true;
*/

const SCRIPT_NAME = 'PingMe';
const STORE_KEY = 'pingme_accounts_v1';

// 操作模式：query / delete
const ACTION = 'query';

// 删除序列号。
// ACTION = 'delete' 时生效。
// 例如删除第 1 个：const DELETE_INDEXES = [1];
// 例如删除第 1 和第 3 个：const DELETE_INDEXES = [1, 3];
const DELETE_INDEXES = [
  // 1,
];

// 删除全部。
// ACTION = 'delete' 时生效，优先级高于 DELETE_INDEXES。
const DELETE_ALL = false;

// 是否在日志里显示完整 store 数据。
// 可能包含敏感信息，默认关闭。
const SHOW_FULL_STORE_IN_LOG = false;

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}

function shortText(text, maxLen) {
  if (text === undefined || text === null) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}

function formatTime(value) {
  if (!value) return '未知';

  const d = new Date(value);

  if (isNaN(d.getTime())) {
    return String(value);
  }

  return d.toLocaleString();
}

function loadStore() {
  const raw = $prefs.valueForKey(STORE_KEY);

  if (!raw) {
    return {
      accounts: {},
      order: []
    };
  }

  const store = safeJsonParse(raw, null);

  if (!store || typeof store !== 'object') {
    return null;
  }

  if (!store.accounts || typeof store.accounts !== 'object') {
    store.accounts = {};
  }

  if (!Array.isArray(store.order)) {
    store.order = Object.keys(store.accounts);
  }

  return store;
}

function saveStore(store) {
  return $prefs.setValueForKey(JSON.stringify(store), STORE_KEY);
}

function buildList(store) {
  const accounts = store.accounts || {};
  const order = Array.isArray(store.order) ? store.order : [];

  const orderedIds = order.filter(id => accounts[id]);
  const extraIds = Object.keys(accounts).filter(id => !orderedIds.includes(id));

  return orderedIds.concat(extraIds).map(id => ({
    id,
    acc: accounts[id]
  }));
}

function getValidDeleteIndexes(max) {
  const set = new Set();

  for (const item of DELETE_INDEXES) {
    const n = Number(item);

    if (Number.isInteger(n) && n >= 1 && n <= max) {
      set.add(n);
    }
  }

  return Array.from(set).sort((a, b) => a - b);
}

function renderList(list) {
  if (!list.length) return '无账号';

  return list.map((item, index) => {
    const acc = item.acc || {};

    return [
      `${index + 1}. ${acc.alias || '未命名'}`,
      `   id：${item.id}`,
      `   更新时间：${formatTime(acc.updatedAt)}`,
      acc.phone ? `   手机号：${maskText(acc.phone)}` : '',
      acc.email ? `   邮箱：${maskEmail(acc.email)}` : '',
      acc.remark ? `   备注：${acc.remark}` : ''
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

function maskText(text) {
  const s = String(text || '');

  if (!s) return '';

  if (/^\d{11}$/.test(s)) {
    return s.slice(0, 3) + '****' + s.slice(7);
  }

  if (s.length > 8) {
    return s.slice(0, 4) + '****' + s.slice(-4);
  }

  if (s.length > 4) {
    return s.slice(0, 2) + '***' + s.slice(-1);
  }

  return s;
}

function maskEmail(email) {
  const s = String(email || '');

  if (!s.includes('@')) return maskText(s);

  const parts = s.split('@');
  const name = parts[0] || '';
  const domain = parts.slice(1).join('@');

  if (name.length <= 2) {
    return `${name.slice(0, 1)}***@${domain}`;
  }

  return `${name.slice(0, 2)}***@${domain}`;
}

function queryStore() {
  const store = loadStore();

  if (store === null) {
    const raw = $prefs.valueForKey(STORE_KEY) || '';
    const msg = [
      '❌ 数据解析失败',
      `本地 Key：${STORE_KEY}`,
      `原始数据预览：${shortText(raw, 500)}`
    ].join('\n');

    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $notify(SCRIPT_NAME, '❌ 数据解析失败', msg);
    $done({});
    return;
  }

  const list = buildList(store);

  if (!list.length) {
    const msg = [
      '暂无账号数据',
      `本地 Key：${STORE_KEY}`
    ].join('\n');

    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $notify(SCRIPT_NAME, '暂无账号数据', msg);
    $done({});
    return;
  }

  const msg = [
    `当前共 ${list.length} 个账号`,
    '',
    renderList(list)
  ].join('\n');

  console.log(`\n【${SCRIPT_NAME}】\n${msg}`);

  if (SHOW_FULL_STORE_IN_LOG) {
    console.log('\n完整 store：');
    console.log(JSON.stringify(store, null, 2));
  }

  $notify(SCRIPT_NAME, `当前共 ${list.length} 个账号`, renderList(list));
  $done({});
}

function deleteStore() {
  const store = loadStore();

  if (store === null) {
    const raw = $prefs.valueForKey(STORE_KEY) || '';
    const msg = [
      '❌ 数据解析失败，无法删除',
      `本地 Key：${STORE_KEY}`,
      `原始数据预览：${shortText(raw, 500)}`
    ].join('\n');

    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $notify(SCRIPT_NAME, '❌ 数据解析失败', msg);
    $done({});
    return;
  }

  const list = buildList(store);

  if (!list.length) {
    const msg = [
      '⚠️ 没有账号数据',
      `本地 Key：${STORE_KEY}`
    ].join('\n');

    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $notify(SCRIPT_NAME, '⚠️ 没有账号数据', msg);
    $done({});
    return;
  }

  if (!DELETE_ALL && DELETE_INDEXES.length === 0) {
    const msg = [
      '未填写 DELETE_INDEXES，本次不会删除。',
      '',
      '当前可删除账号：',
      renderList(list),
      '',
      '需要删除哪个账号，就把上面的序列号填进 DELETE_INDEXES。',
      '例如删除第 1 个：const DELETE_INDEXES = [1];',
      '例如删除第 1 和第 3 个：const DELETE_INDEXES = [1, 3];'
    ].join('\n');

    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $notify(SCRIPT_NAME, '请选择序列号', msg);
    $done({});
    return;
  }

  let deleteIndexes = [];

  if (DELETE_ALL) {
    deleteIndexes = list.map((_, index) => index + 1);
  } else {
    deleteIndexes = getValidDeleteIndexes(list.length);
  }

  if (!deleteIndexes.length) {
    const msg = [
      `DELETE_INDEXES 无有效序列号：${JSON.stringify(DELETE_INDEXES)}`,
      `有效范围：1 - ${list.length}`,
      '',
      '当前可删除账号：',
      renderList(list)
    ].join('\n');

    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $notify(SCRIPT_NAME, '序列号无效', msg);
    $done({});
    return;
  }

  const deleted = [];

  for (const index of deleteIndexes) {
    const item = list[index - 1];

    if (!item || !item.id) continue;

    const acc = item.acc || {};

    deleted.push({
      index,
      id: item.id,
      alias: acc.alias || '未命名',
      updatedAt: acc.updatedAt || ''
    });

    delete store.accounts[item.id];
  }

  store.order = Array.isArray(store.order)
    ? store.order.filter(id => store.accounts[id])
    : Object.keys(store.accounts || {});

  saveStore(store);

  const remainList = buildList(store);

  const msg = [
    `✅ 已删除 ${deleted.length} 个账号：`,
    ...deleted.map(item => `${item.index}. ${item.alias} / id: ${item.id}`),
    '',
    `剩余：${remainList.length} 个`,
    remainList.length ? '\n当前剩余账号：\n' + renderList(remainList) : ''
  ].join('\n');

  console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
  $notify(SCRIPT_NAME, `✅ 已删除 ${deleted.length} 个账号`, msg);
  $done({});
}

try {
  if (ACTION === 'delete') {
    deleteStore();
  } else {
    queryStore();
  }
} catch (e) {
  const err = e && e.message ? e.message : String(e);

  console.log(`\n【${SCRIPT_NAME}】脚本异常：${err}`);
  $notify(SCRIPT_NAME, '脚本异常', err);

  $done({});
}