// 2026/05/06
/*
项目: 大潮
名称: 大潮 member 查删一体
用途:
1. 查询 Quantumult X 本地保存的 member 数据
2. 删除指定 member
3. 自动清理旧版本 history 字段
4. 自动修复最近一次记录

本地 Key:
dctx_member_store_v1
dctx_member_last_v1

使用方式:

查询全部:
const ACTION = 'query';

查询指定账号:
const ACTION = 'query';
const QUERY_TARGETS = ['手机号或member ID'];

删除第 1 个:
const ACTION = 'delete';
const DELETE_INDEXES = [1];

删除第 1 和第 3 个:
const ACTION = 'delete';
const DELETE_INDEXES = [1, 3];

按手机号 / ID / key 删除:
const ACTION = 'delete';
const DELETE_TARGETS = ['1293d527550bb307ea8c6edc5f90ef76'];

删除全部:
const ACTION = 'delete';
const DELETE_ALL = true;

QX task 示例:
0 9 * * * DCTX_Member_Manage_QX.js, tag=大潮member查删, enabled=false
*/

const SCRIPT_NAME = '大潮 member 查删';
const STORE_KEY = 'dctx_member_store_v1';
const LAST_KEY = 'dctx_member_last_v1';

// 操作模式：query / delete
const ACTION = 'query';

// 查询目标。
// 留空查询全部；可填手机号 / ID / key。
const QUERY_TARGETS = [
  // '13800138000',
  // '1293d527550bb307ea8c6edc5f90ef76',
];

// 删除序号。
// ACTION = 'delete' 时生效。
// 例如删除第 1 个：const DELETE_INDEXES = [1];
// 例如删除第 1 和第 3 个：const DELETE_INDEXES = [1, 3];
const DELETE_INDEXES = [
  // 1,
];

// 删除目标。
// 可填手机号 / ID / key。
// ACTION = 'delete' 时生效。
const DELETE_TARGETS = [
  // '13800138000',
  // '1293d527550bb307ea8c6edc5f90ef76',
];

// 删除全部。
// ACTION = 'delete' 时生效，优先级最高。
const DELETE_ALL = false;

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

function loadLastRecord() {
  const raw = $prefs.valueForKey(LAST_KEY);
  return safeJsonParse(raw, null);
}

function saveLastRecord(record) {
  if (!record) {
    $prefs.removeValueForKey(LAST_KEY);
    return;
  }

  $prefs.setValueForKey(JSON.stringify(record), LAST_KEY);
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

function getRecordName(rec) {
  const parsed = safeJsonParse(rec && rec.raw, {});
  return getRecordNickname(rec || {}, parsed) || '未知';
}

function getRecordValues(item) {
  const rec = item.rec || {};
  const parsed = safeJsonParse(rec.raw, {});

  return [
    item.key,
    rec.key,
    rec.phone,
    rec.mobile,
    rec.id,
    parsed.id,
    parsed.phone,
    parsed.mobile,
    parsed.account_id,
    parsed.accountId
  ].map(v => String(v || '').trim()).filter(Boolean);
}

function matchRecord(item, targets) {
  if (!targets || targets.length === 0) {
    return true;
  }

  const values = getRecordValues(item);
  return targets.some(t => values.includes(String(t || '').trim()));
}

function isLastRecord(item, rec, parsed, lastRecord) {
  if (!lastRecord) return false;

  const id = getRecordId(rec, parsed);

  return (
    String(lastRecord.key || '') === String(item.key || '') ||
    String(lastRecord.key || '') === String(rec.key || '') ||
    String(lastRecord.id || '') === String(id || '') ||
    String(lastRecord.raw || '') === String(rec.raw || '')
  );
}

function repairLastRecordIfNeeded(store, list, lastRecord) {
  if (!list.length) {
    saveLastRecord(null);
    return null;
  }

  if (!lastRecord) {
    const first = list[0].rec;
    const firstKey = list[0].key;

    const repaired = {
      key: first.key || firstKey,
      id: first.id || '',
      phone: first.phone || '',
      mobile: first.mobile || '',
      nickname: first.nickname || '',
      source: first.source || '',
      expire: first.expire || '',
      updatedAt: first.updatedAt || '',
      raw: first.raw || ''
    };

    saveLastRecord(repaired);
    return repaired;
  }

  return lastRecord;
}

function repairLastKey(store) {
  const list = buildList(store);

  if (!list.length) {
    saveLastRecord(null);
    return;
  }

  const first = list[0].rec;
  const firstKey = list[0].key;

  saveLastRecord({
    key: first.key || firstKey,
    id: first.id || '',
    phone: first.phone || '',
    mobile: first.mobile || '',
    nickname: first.nickname || '',
    source: first.source || '',
    expire: first.expire || '',
    updatedAt: first.updatedAt || '',
    raw: first.raw || ''
  });
}

function renderAccountList(list, lastRecord) {
  return list.map((item, idx) => {
    const rec = item.rec;
    const parsed = safeJsonParse(rec.raw, {});
    const expireRaw = getRecordExpire(rec, parsed);
    const lastFlag = isLastRecord(item, rec, parsed, lastRecord) ? '是' : '否';

    return [
      `${idx + 1}. 账号：${maskPhone(rec.key || item.key)}`,
      `   ID：${getRecordId(rec, parsed)}`,
      `   昵称：${getRecordNickname(rec, parsed) || '未知'}`,
      `   来源：${getRecordSource(rec, parsed)}`,
      `   过期：${expireRaw ? `${formatExpire(expireRaw)} (${expireRaw})` : '未知'}`,
      `   更新时间：${rec.updatedAt || '未知'}`,
      `   最近更新：${lastFlag}`
    ].join('\n');
  }).join('\n\n');
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

function getDeleteIndexesByTargets(list) {
  const targets = DELETE_TARGETS
    .map(v => String(v || '').trim())
    .filter(Boolean);

  if (!targets.length) {
    return [];
  }

  const indexes = [];

  list.forEach((item, idx) => {
    const values = getRecordValues(item);

    if (targets.some(t => values.includes(t))) {
      indexes.push(idx + 1);
    }
  });

  return indexes;
}

function getMergedDeleteIndexes(list) {
  if (DELETE_ALL) {
    return list.map((_, idx) => idx + 1);
  }

  const byIndex = getValidDeleteIndexes(list.length);
  const byTarget = getDeleteIndexesByTargets(list);

  return Array.from(new Set(byIndex.concat(byTarget))).sort((a, b) => a - b);
}

function queryStore() {
  if (typeof $prefs === 'undefined') {
    const msg = '当前环境不支持 $prefs，请在 Quantumult X 中运行';
    console.log(`❌ ${msg}`);
    if (typeof $notify !== 'undefined') {
      $notify('🌟 大潮 member 查删', '环境错误', msg);
    }
    $done({});
    return;
  }

  const store = loadStore();
  const cleanedHistoryCount = cleanupLegacyHistory(store);

  const list = buildList(store);
  let lastRecord = loadLastRecord();
  lastRecord = repairLastRecordIfNeeded(store, list, lastRecord);

  const targets = QUERY_TARGETS
    .map(v => String(v).trim())
    .filter(Boolean);

  const selected = list.filter(item => matchRecord(item, targets));

  if (selected.length === 0) {
    const msg = list.length === 0
      ? `未找到本地 member\n本地 Key：${STORE_KEY}`
      : `未匹配到指定账号\n当前已保存：${list.map(x => maskPhone(x.rec.key || x.key)).join('、')}`;

    console.log(`\n【${SCRIPT_NAME}】${msg}`);
    $notify('🌟 大潮 member 查询', '未找到记录', msg);
    $done({});
    return;
  }

  const blocks = selected.map((item, idx) => {
    const rec = item.rec;
    const parsed = safeJsonParse(rec.raw, {});
    const expireRaw = getRecordExpire(rec, parsed);
    const expireText = expireRaw
      ? `${formatExpire(expireRaw)} (${expireRaw})`
      : '未知';
    const lastFlag = isLastRecord(item, rec, parsed, lastRecord) ? '是' : '否';

    return [
      `【${idx + 1}】账号：${maskPhone(rec.key || item.key)}`,
      `ID：${getRecordId(rec, parsed)}`,
      `昵称：${getRecordNickname(rec, parsed) || '未知'}`,
      `来源：${getRecordSource(rec, parsed)}`,
      `过期：${expireText}`,
      `更新时间：${rec.updatedAt || '未知'}`,
      `最近更新：${lastFlag}`,
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

function deleteStore() {
  if (typeof $prefs === 'undefined') {
    const msg = '当前环境不支持 $prefs，请在 Quantumult X 中运行';
    console.log(`❌ ${msg}`);
    if (typeof $notify !== 'undefined') {
      $notify('🌟 大潮 member 删除', '环境错误', msg);
    }
    $done({});
    return;
  }

  const store = loadStore();
  cleanupLegacyHistory(store);

  const list = buildList(store);
  const lastRecord = loadLastRecord();

  if (list.length === 0) {
    const msg = `当前没有本地 member 记录\n本地 Key：${STORE_KEY}`;

    console.log(`\n【${SCRIPT_NAME}】${msg}`);
    $notify('🌟 大潮 member 删除', '无记录', msg);
    $done({});
    return;
  }

  if (!DELETE_ALL && DELETE_INDEXES.length === 0 && DELETE_TARGETS.length === 0) {
    const msg = [
      '未填写 DELETE_INDEXES / DELETE_TARGETS，本次不会删除。',
      '',
      '当前可删除账号：',
      renderAccountList(list, lastRecord),
      '',
      '删除第 1 个：const DELETE_INDEXES = [1];',
      '删除第 1 和第 3 个：const DELETE_INDEXES = [1, 3];',
      "按 ID 删除：const DELETE_TARGETS = ['member ID'];",
      '删除全部：const DELETE_ALL = true;'
    ].join('\n');

    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $notify('🌟 大潮 member 删除', '请选择删除目标', msg);
    $done({});
    return;
  }

  const deleteIndexes = getMergedDeleteIndexes(list);

  if (!deleteIndexes.length) {
    const msg = [
      `DELETE_INDEXES 无有效序列号：${JSON.stringify(DELETE_INDEXES)}`,
      `DELETE_TARGETS 未匹配到账号：${JSON.stringify(DELETE_TARGETS)}`,
      '',
      `有效序号范围：1 - ${list.length}`,
      '',
      '当前可删除账号：',
      renderAccountList(list, lastRecord)
    ].join('\n');

    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $notify('🌟 大潮 member 删除', '未匹配到账号', msg);
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
      id: getRecordId(item.rec, safeJsonParse(item.rec.raw, {})),
      name: getRecordName(item.rec)
    });

    delete store.accounts[item.key];
  }

  saveStore(store);
  repairLastKey(store);

  const newLastRecord = loadLastRecord();
  const remainList = buildList(store);

  const msg = [
    `已删除 ${deleted.length} 个账号 member：`,
    ...deleted.map(x => `${x.index}. ${maskPhone(x.account)} / ID: ${x.id} / 昵称: ${x.name}`),
    '',
    `剩余：${remainList.length} 个`,
    remainList.length ? '\n当前剩余账号：\n' + renderAccountList(remainList, newLastRecord) : ''
  ].join('\n');

  console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
  $notify('🌟 大潮 member 删除', `已删除 ${deleted.length} 个`, msg);

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
  console.log(`【${SCRIPT_NAME}】脚本异常：${err}`);

  if (typeof $notify !== 'undefined') {
    $notify('🌟 大潮 member 查删', '脚本异常', err);
  }

  if (typeof $done !== 'undefined') {
    $done({});
  }
}