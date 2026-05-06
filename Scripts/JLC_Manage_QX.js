// 2026/05/06
/*
项目: 嘉立创 JLC 小程序
名称: 嘉立创本地授权管理
用途:
1. 查询 QX 本地保存的 JLC 授权信息
2. 按序列号删除指定账号授权
3. 删除全部授权

QX task 示例:
0 9 * * * JLC_Manage_QX.js, tag=嘉立创授权管理, enabled=false
*/

const SCRIPT_NAME = '🖨️ 嘉立创授权管理';
const STORE_KEY = 'jlc_auth_store_v1';
const LAST_KEY = 'jlc_auth_last_v1';
const LAST_RESULT_KEY = 'jlc_last_result_v1';

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

// 是否显示完整 token / secret / cookie。敏感信息，默认关闭。
const SHOW_FULL_AUTH = false;

const $ = new Env(SCRIPT_NAME);

try {
  main();
} catch (e) {
  const err = e && e.message ? e.message : String(e);
  console.log(`❌ ${SCRIPT_NAME} 异常：${err}`);
  $.msg(SCRIPT_NAME, '脚本异常', err);
} finally {
  $.done({});
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

function maskText(text) {
  if (!text) return '';

  if (SHOW_FULL_AUTH) {
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

  if (SHOW_FULL_AUTH) {
    return String(cookie);
  }

  return String(cookie)
    .replace(/([A-Za-z0-9_\-]*token[A-Za-z0-9_\-]*=)[^;]+/gi, '$1***')
    .replace(/([A-Za-z0-9_\-]*session[A-Za-z0-9_\-]*=)[^;]+/gi, '$1***')
    .replace(/([A-Za-z0-9_\-]*cookie[A-Za-z0-9_\-]*=)[^;]+/gi, '$1***')
    .replace(/([A-Za-z0-9_\-]*id[A-Za-z0-9_\-]*=)[^;]+/gi, '$1***');
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

function buildList(store) {
  return Object.keys(store.accounts || {})
    .map(key => ({
      key,
      rec: store.accounts[key]
    }))
    .filter(x => x.rec)
    .sort((a, b) => {
      const ta = new Date(a.rec.updatedAt || a.rec.lastSeenAt || 0).getTime() || 0;
      const tb = new Date(b.rec.updatedAt || b.rec.lastSeenAt || 0).getTime() || 0;
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
  const list = buildList(store);

  if (!list.length) {
    $.remove(LAST_KEY);
    return;
  }

  $.setdata(JSON.stringify(list[0].rec), LAST_KEY);
}

function renderList(list) {
  return list.map((item, idx) => {
    const rec = item.rec;
    const lr = rec.lastResult || {};
    const total = rec.total !== null && rec.total !== undefined ? rec.total : '未知';

    return [
      `${idx + 1}. 备注：${rec.remark || '未知'}`,
      `   Key：${item.key}`,
      `   Token：${maskText(rec.token)}`,
      `   Secret：${maskText(rec.secret)}`,
      `   Cookie：${rec.cookie ? shortText(maskCookie(rec.cookie), 220) : '无'}`,
      `   UA：${shortText(rec.userAgent || '', 160) || '无'}`,
      `   额外 Header：${rec.extraHeaders && Object.keys(rec.extraHeaders).length ? JSON.stringify(rec.extraHeaders) : '无'}`,
      `   首次/刷新时间：${rec.updatedAt || '未知'}`,
      `   最近捕获：${rec.lastSeenAt || '未知'}`,
      `   最近运行：${rec.lastRunAt || '未运行'}`,
      `   当前豆豆：${total}`,
      `   豆豆有效期：${rec.expireTime || '未知'}`,
      `   最近结果：${lr && lr.ok !== undefined ? (lr.ok ? '成功' : '失败') : '未知'}`
    ].join('\n');
  }).join('\n\n');
}

function queryStore() {
  const store = loadStore();
  const list = buildList(store);

  if (!list.length) {
    const msg = [
      '未找到本地 JLC 授权信息。',
      `本地 Key：${STORE_KEY}`,
      '',
      '请先打开嘉立创小程序并触发 m.jlc.com 接口，让 QX 自动保存 token 和 secret。'
    ].join('\n');

    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $.msg(SCRIPT_NAME, '无本地授权', msg);
    return;
  }

  const msg = [
    `本地授权数量：${list.length}`,
    `本地 Key：${STORE_KEY}`,
    '',
    renderList(list)
  ].join('\n');

  console.log(`\n【${SCRIPT_NAME}】\n${msg}`);

  $.msg(
    SCRIPT_NAME,
    `共 ${list.length} 个账号`,
    list.map((item, idx) => {
      const rec = item.rec;
      return `${idx + 1}. ${rec.remark || item.key}｜豆豆：${rec.total !== null && rec.total !== undefined ? rec.total : '未知'}｜最近运行：${rec.lastRunAt || '未运行'}`;
    }).join('\n')
  );
}

function deleteStore() {
  const store = loadStore();
  const list = buildList(store);

  if (!list.length) {
    const msg = `当前没有本地授权信息\n本地 Key：${STORE_KEY}`;
    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $.msg(SCRIPT_NAME, '无记录', msg);
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
    $.msg(SCRIPT_NAME, '请选择序列号', msg);
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
      `有效范围：1 - ${list.length}`,
      '',
      '当前可删除账号：',
      renderList(list)
    ].join('\n');

    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $.msg(SCRIPT_NAME, '序列号无效', msg);
    return;
  }

  const deleted = [];

  for (const index of deleteIndexes) {
    const item = list[index - 1];

    if (!item || !item.rec) continue;

    deleted.push({
      index,
      key: item.key,
      remark: item.rec.remark || item.key
    });

    delete store.accounts[item.key];
  }

  saveStore(store);
  updateLastKey(store);

  const remain = buildList(store);

  if (!remain.length) {
    $.remove(LAST_RESULT_KEY);
  }

  const msg = [
    `已删除 ${deleted.length} 个授权：`,
    ...deleted.map(x => `${x.index}. ${x.remark} / Key: ${x.key}`),
    '',
    `剩余：${remain.length} 个`,
    remain.length ? '\n当前剩余账号：\n' + renderList(remain) : ''
  ].join('\n');

  console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
  $.msg(SCRIPT_NAME, `已删除 ${deleted.length} 个`, msg);
}

function main() {
  if (ACTION === 'delete') {
    deleteStore();
  } else {
    queryStore();
  }
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

    remove(key) {
      if (typeof $prefs !== 'undefined') {
        return $prefs.removeValueForKey(key);
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