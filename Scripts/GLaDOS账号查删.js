// 2026/05/06
/*
@Name：GLaDOS 本地账号查删一体
@Description：
- 查询 Quantumult X $prefs 中保存的 GLaDOS 账号
- 删除指定 GLaDOS 账号
- 支持按序号 / 邮箱 / 账号 ID / 别名删除
- 默认隐藏 Cookie

本地 Key：
glados_accounts_v1

使用方法：

查询：
const ACTION = 'query';

按序号删除第 1 个：
const ACTION = 'delete';
const DELETE_INDEXES = [1];

按序号删除多个：
const ACTION = 'delete';
const DELETE_INDEXES = [1, 3];

按邮箱 / ID / 别名删除：
const ACTION = 'delete';
const DELETE_TARGETS = ['example@gmail.com'];

删除全部：
const ACTION = 'delete';
const DELETE_ALL = true;
*/

const SCRIPT_NAME = 'GLaDOS';
const STORE_KEY = 'glados_accounts_v1';

// 操作模式：query / delete
const ACTION = 'query';

// 删除序号。
// ACTION = 'delete' 时生效。
// 例如删除第 1 个：const DELETE_INDEXES = [1];
// 例如删除第 1 和第 3 个：const DELETE_INDEXES = [1, 3];
const DELETE_INDEXES = [
  // 1,
];

// 删除目标。
// 可填邮箱 / 账号 ID / 别名。
// ACTION = 'delete' 时生效。
const DELETE_TARGETS = [
  // 'example@gmail.com',
  // '账号ID',
];

// 删除全部。
// ACTION = 'delete' 时生效，优先级最高。
const DELETE_ALL = false;

// 是否在日志中显示完整 Cookie。
// 不建议开启，Cookie 属于敏感信息。
const SHOW_COOKIE_IN_LOG = false;

// 是否在日志中打印完整 store。
// 可能包含敏感数据，默认关闭。
const SHOW_FULL_STORE_IN_LOG = false;

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

function notify(title, body) {
  $notify(SCRIPT_NAME, title, body);
}

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

function formatNumber(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback || '未知';
  }

  const n = Number(value);

  if (isNaN(n)) {
    return fallback || '未知';
  }

  return String(parseInt(n, 10));
}

function formatDays(value) {
  return formatNumber(value, '未知');
}

function formatPoints(value) {
  return formatNumber(value, '未知');
}

function formatTime(ts) {
  if (!ts) return '未知';

  const d = new Date(ts);

  if (isNaN(d.getTime())) {
    return String(ts);
  }

  return d.toLocaleString();
}

function maskCookie(cookie) {
  if (!cookie) return '未保存';

  if (SHOW_COOKIE_IN_LOG) {
    return String(cookie);
  }

  return String(cookie)
    .replace(/(koa:sess=)[^;]+/gi, '$1***')
    .replace(/(koa:sess\.sig=)[^;]+/gi, '$1***')
    .replace(/(token=)[^;]+/gi, '$1***')
    .replace(/(session=)[^;]+/gi, '$1***')
    .replace(/(auth=)[^;]+/gi, '$1***')
    .replace(/(authorization=)[^;]+/gi, '$1***');
}

function maskText(text) {
  if (!text) return '';

  const s = String(text);

  if (s.includes('@')) {
    return maskEmail(s);
  }

  if (s.length > 12) {
    return s.slice(0, 6) + '***' + s.slice(-6);
  }

  if (s.length > 6) {
    return s.slice(0, 3) + '***' + s.slice(-2);
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

function loadStore() {
  const raw = $prefs.valueForKey(STORE_KEY);

  if (!raw) {
    return {
      ok: true,
      empty: true,
      raw: '',
      store: {
        version: 1,
        accounts: {},
        order: []
      }
    };
  }

  const store = safeJsonParse(raw, null);

  if (!store || typeof store !== 'object') {
    return {
      ok: false,
      empty: false,
      raw,
      store: null
    };
  }

  if (!store.accounts || typeof store.accounts !== 'object') {
    store.accounts = {};
  }

  if (!Array.isArray(store.order)) {
    store.order = Object.keys(store.accounts);
  }

  return {
    ok: true,
    empty: false,
    raw,
    store
  };
}

function saveStore(store) {
  return $prefs.setValueForKey(JSON.stringify(store), STORE_KEY);
}

function getIds(store) {
  const accounts = store.accounts || {};
  const order = Array.isArray(store.order) ? store.order : [];

  const orderedIds = order.filter(id => accounts[id]);
  const extraIds = Object.keys(accounts).filter(id => !orderedIds.includes(id));

  return orderedIds.concat(extraIds);
}

function buildList(store) {
  return getIds(store).map(id => ({
    id,
    acc: store.accounts[id] || {}
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

function recordCandidates(id, acc) {
  return [
    id,
    acc.id,
    acc.email,
    acc.alias
  ]
    .filter(Boolean)
    .map(v => String(v).trim().toLowerCase());
}

function findTargetIndexes(list) {
  const targets = DELETE_TARGETS
    .map(v => String(v || '').trim().toLowerCase())
    .filter(Boolean);

  if (!targets.length) {
    return [];
  }

  const indexes = [];

  list.forEach((item, idx) => {
    const candidates = recordCandidates(item.id, item.acc);

    if (targets.some(t => candidates.includes(t))) {
      indexes.push(idx + 1);
    }
  });

  return indexes;
}

function mergeDeleteIndexes(list) {
  if (DELETE_ALL) {
    return list.map((_, idx) => idx + 1);
  }

  const byIndex = getValidDeleteIndexes(list.length);
  const byTarget = findTargetIndexes(list);

  return Array.from(new Set(byIndex.concat(byTarget))).sort((a, b) => a - b);
}

function getDisplayName(id, acc) {
  return acc.email || acc.alias || id || '未知账号';
}

function renderAccount(item, index, detail) {
  const id = item.id;
  const acc = item.acc || {};

  const email = acc.email || '';
  const alias = acc.alias || '';
  const hasCookie = acc.cookie ? '已保存' : '未保存';

  const rows = [
    `${index}. ${getDisplayName(id, acc)}`,
    `   账号 ID：${id}`,
    `   邮箱：${email ? maskEmail(email) : '未获取'}`,
    `   别名：${alias || '未设置'}`,
    `   Cookie：${hasCookie}`,
    `   剩余天数：${formatDays(acc.leftDays)} 天`,
    `   积分：${formatPoints(acc.points)}`,
    `   创建时间：${formatTime(acc.createdAt)}`,
    `   更新时间：${formatTime(acc.updatedAt)}`,
    `   最近查询：${formatTime(acc.lastQueryAt)}`,
    `   最近任务：${formatTime(acc.lastTaskAt)}`
  ];

  if (detail) {
    rows.push(`   Cookie 预览：${shortText(maskCookie(acc.cookie), 220)}`);

    if (acc.status !== undefined && acc.status !== null) {
      rows.push(`   状态：${acc.status}`);
    }

    if (acc.plan !== undefined && acc.plan !== null) {
      rows.push(`   套餐：${acc.plan}`);
    }

    if (acc.message) {
      rows.push(`   消息：${shortText(acc.message, 180)}`);
    }
  }

  return rows.join('\n');
}

function renderList(list, detail) {
  if (!list.length) return '无账号';

  return list
    .map((item, idx) => renderAccount(item, idx + 1, detail))
    .join('\n\n');
}

function queryStore() {
  const loaded = loadStore();

  if (!loaded.ok) {
    logBlock('❌ 本地数据解析失败', [
      `存储 Key：${STORE_KEY}`,
      '原因：JSON 解析失败',
      `原始数据预览：${shortText(loaded.raw || '', 500)}`
    ]);

    notify(
      '❌ 本地数据解析失败',
      `请检查 ${STORE_KEY}`
    );

    $done({});
    return;
  }

  if (loaded.empty) {
    logBlock('📭 暂无 GLaDOS 本地账号', [
      `存储 Key：${STORE_KEY}`,
      '状态：没有找到本地保存的账号数据',
      '提示：请先通过浏览器自动提取 Cookie'
    ]);

    notify(
      '📭 暂无本地账号',
      '请先用 Safari / Edge / Chrome 登录 GLaDOS 并触发抓取'
    );

    $done({});
    return;
  }

  const store = loaded.store;
  const list = buildList(store);

  if (!list.length) {
    logBlock('📭 暂无有效账号', [
      `存储 Key：${STORE_KEY}`,
      '状态：存在本地数据，但账号列表为空'
    ]);

    notify(
      '📭 暂无有效账号',
      '本地账号列表为空'
    );

    $done({});
    return;
  }

  logBlock('📦 GLaDOS 本地账号总览', [
    `存储 Key：${STORE_KEY}`,
    `账号数量：${list.length}`,
    `数据版本：${store.version || '未知'}`,
    '网络查询：关闭',
    `Cookie 显示：${SHOW_COOKIE_IN_LOG ? '完整显示' : '已隐藏'}`
  ]);

  list.forEach((item, idx) => {
    const acc = item.acc || {};

    logBlock(`👤 账号 ${idx + 1}/${list.length}`, [
      `序号：${idx + 1}`,
      `账号 ID：${item.id}`,
      `邮箱：${acc.email || '未获取'}`,
      `别名：${acc.alias || '未设置'}`,
      `Cookie：${acc.cookie ? '已保存' : '未保存'}`,
      `Cookie 预览：${shortText(maskCookie(acc.cookie), 220)}`,
      `剩余天数：${formatDays(acc.leftDays)} 天`,
      `积分：${formatPoints(acc.points)}`,
      `创建时间：${formatTime(acc.createdAt)}`,
      `更新时间：${formatTime(acc.updatedAt)}`,
      `最近查询：${formatTime(acc.lastQueryAt)}`,
      `最近任务：${formatTime(acc.lastTaskAt)}`
    ]);
  });

  if (SHOW_FULL_STORE_IN_LOG) {
    console.log('\n完整 store：');
    console.log(JSON.stringify(store, null, 2));
  }

  const notifyRows = list.map((item, idx) => {
    const acc = item.acc || {};
    const email = getDisplayName(item.id, acc);
    const hasCookie = acc.cookie ? '已保存' : '未保存';

    return (
      `${idx + 1}. ${email}\n` +
      `Cookie：${hasCookie}\n` +
      `剩余：${formatDays(acc.leftDays)} 天｜积分：${formatPoints(acc.points)}`
    );
  });

  notify(
    `📦 本地共 ${list.length} 个账号`,
    notifyRows.join('\n\n')
  );

  $done({});
}

function deleteStore() {
  const loaded = loadStore();

  if (!loaded.ok) {
    logBlock('❌ 删除失败', [
      `存储 Key：${STORE_KEY}`,
      '原因：JSON 解析失败',
      `原始数据预览：${shortText(loaded.raw || '', 500)}`
    ]);

    notify('❌ 删除失败', '本地数据解析失败');
    $done({});
    return;
  }

  if (loaded.empty) {
    logBlock('📭 暂无账号', [
      `存储 Key：${STORE_KEY}`
    ]);

    notify('📭 暂无账号', '没有可删除的账号');
    $done({});
    return;
  }

  const store = loaded.store;
  const list = buildList(store);

  if (!list.length) {
    logBlock('📭 暂无有效账号', [
      `存储 Key：${STORE_KEY}`
    ]);

    notify('📭 暂无有效账号', '账号列表为空');
    $done({});
    return;
  }

  if (!DELETE_ALL && DELETE_INDEXES.length === 0 && DELETE_TARGETS.length === 0) {
    logBlock('⚠️ 未选择删除账号', [
      '未填写 DELETE_INDEXES / DELETE_TARGETS',
      '本次不会删除。',
      '',
      '当前可删除账号：',
      renderList(list, false)
    ]);

    notify(
      '⚠️ 请选择删除账号',
      [
        '未填写 DELETE_INDEXES / DELETE_TARGETS',
        '',
        renderList(list, false)
      ].join('\n')
    );

    $done({});
    return;
  }

  const deleteIndexes = mergeDeleteIndexes(list);

  if (!deleteIndexes.length) {
    logBlock('⚠️ 未找到要删除的账号', [
      `DELETE_INDEXES：${JSON.stringify(DELETE_INDEXES)}`,
      `DELETE_TARGETS：${JSON.stringify(DELETE_TARGETS)}`,
      `有效序号范围：1 - ${list.length}`,
      '',
      '当前账号：',
      renderList(list, false)
    ]);

    notify(
      '⚠️ 未找到账号',
      `请检查 DELETE_INDEXES / DELETE_TARGETS\n当前账号数：${list.length}`
    );

    $done({});
    return;
  }

  const before = list.length;
  const deleted = [];

  for (const index of deleteIndexes) {
    const item = list[index - 1];

    if (!item || !item.id) continue;

    const acc = item.acc || {};

    deleted.push({
      index,
      id: item.id,
      email: acc.email || '',
      alias: acc.alias || ''
    });

    delete store.accounts[item.id];
  }

  store.order = Array.isArray(store.order)
    ? store.order.filter(id => store.accounts[id])
    : Object.keys(store.accounts || {});

  saveStore(store);

  const remainList = buildList(store);
  const after = remainList.length;

  logBlock('🗑️ 已删除 GLaDOS 账号', [
    `删除数量：${deleted.length}`,
    `删除前账号数：${before}`,
    `删除后账号数：${after}`,
    '',
    ...deleted.map(x => `${x.index}. ${x.email || x.alias || x.id} / ID: ${x.id}`)
  ]);

  notify(
    `🗑️ 已删除 ${deleted.length} 个账号`,
    [
      ...deleted.map(x => `${x.index}. ${x.email || x.alias || x.id}`),
      '',
      `剩余账号：${after}`
    ].join('\n')
  );

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

  logBlock('❌ 脚本异常', [
    `错误：${err}`
  ]);

  notify('❌ 脚本异常', err);

  $done({});
}
