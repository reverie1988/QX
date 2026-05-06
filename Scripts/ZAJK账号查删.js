// 2026/05/06
/*
项目: 众安健康
名称: 众安健康账号查删一体
用途:
1. 查询 Quantumult X 本地保存的众安健康账号
2. 删除指定众安健康账号
3. 支持按序号 / ID / 别名删除
4. 支持删除全部
5. 默认隐藏 Token / Cookie

本地 Key:
zajk_accounts_v1

使用方法:

查询:
const ACTION = 'query';

删除第 1 个:
const ACTION = 'delete';
const DELETE_INDEXES = [1];

删除第 1 和第 3 个:
const ACTION = 'delete';
const DELETE_INDEXES = [1, 3];

按 ID / 别名删除:
const ACTION = 'delete';
const DELETE_TARGETS = ['账号ID或别名'];

删除全部:
const ACTION = 'delete';
const DELETE_ALL = true;
*/

const SCRIPT_NAME = '🏢 众安健康';
const STORE_KEY = 'zajk_accounts_v1';

// 操作模式：query / delete
const ACTION = 'query';

// 删除序号。
// ACTION = 'delete' 时生效。
const DELETE_INDEXES = [
  // 1,
];

// 删除目标。
// 可填 id / alias。
// ACTION = 'delete' 时生效。
const DELETE_TARGETS = [
  // '账号ID',
  // '别名',
];

// 删除全部。
// ACTION = 'delete' 时生效，优先级最高。
const DELETE_ALL = false;

// 是否显示完整敏感信息。
// 不建议开启，可能包含 token / cookie。
const SHOW_SENSITIVE = false;

// 是否在日志里打印完整 store。
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

function formatTime(value) {
  if (!value) return '未知';

  const d = new Date(value);

  if (isNaN(d.getTime())) {
    return String(value);
  }

  return d.toLocaleString();
}

function maskText(text) {
  if (!text) return '';

  if (SHOW_SENSITIVE) {
    return String(text);
  }

  const s = String(text);

  if (s.length <= 12) {
    return '***';
  }

  return s.slice(0, 6) + '****' + s.slice(-4);
}

function maskCookie(cookie) {
  if (!cookie) return '未保存';

  if (SHOW_SENSITIVE) {
    return String(cookie);
  }

  return String(cookie)
    .replace(/([A-Za-z0-9_\-]*token[A-Za-z0-9_\-]*=)[^;]+/gi, '$1***')
    .replace(/([A-Za-z0-9_\-]*session[A-Za-z0-9_\-]*=)[^;]+/gi, '$1***')
    .replace(/([A-Za-z0-9_\-]*cookie[A-Za-z0-9_\-]*=)[^;]+/gi, '$1***')
    .replace(/([A-Za-z0-9_\-]*auth[A-Za-z0-9_\-]*=)[^;]+/gi, '$1***')
    .replace(/([A-Za-z0-9_\-]*id[A-Za-z0-9_\-]*=)[^;]+/gi, '$1***');
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
        updatedAt: '',
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
  store.updatedAt = Date.now();
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
    acc.alias,
    acc.phone,
    acc.mobile,
    acc.name
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
  return acc.alias || acc.name || acc.phone || acc.mobile || id || '未命名';
}

function renderAccount(item, index, detail) {
  const id = item.id;
  const acc = item.acc || {};

  const rows = [
    `${index}. ${getDisplayName(id, acc)}`,
    `   id：${id}`,
    `   别名：${acc.alias || '未命名'}`,
    acc.name ? `   名称：${acc.name}` : '',
    acc.phone ? `   手机号：${maskText(acc.phone)}` : '',
    acc.mobile ? `   Mobile：${maskText(acc.mobile)}` : '',
    `   Token：${maskText(acc.token) || '未保存'}`,
    `   Cookie：${acc.cookie ? '已保存' : '未保存'}`,
    `   更新时间：${formatTime(acc.updatedAt)}`
  ].filter(Boolean);

  if (detail) {
    rows.push(`   Cookie 预览：${shortText(maskCookie(acc.cookie), 220)}`);

    if (acc.userId || acc.uid) {
      rows.push(`   用户ID：${acc.userId || acc.uid}`);
    }

    if (acc.remark) {
      rows.push(`   备注：${acc.remark}`);
    }

    if (acc.captureUrl) {
      rows.push(`   捕获 URL：${shortText(acc.captureUrl, 220)}`);
    }

    if (acc.lastRunAt) {
      rows.push(`   最近任务：${formatTime(acc.lastRunAt)}`);
    }

    if (acc.lastResult) {
      rows.push(`   最近结果：${shortText(JSON.stringify(acc.lastResult), 220)}`);
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
    logBlock('❌ 数据解析失败', [
      `存储 Key：${STORE_KEY}`,
      '原因：JSON 解析失败',
      `原始数据预览：${shortText(loaded.raw || '', 500)}`
    ]);

    notify('❌ 数据解析失败', `请检查 ${STORE_KEY}`);
    $done({});
    return;
  }

  if (loaded.empty) {
    logBlock('📭 暂无账号数据', [
      `存储 Key：${STORE_KEY}`,
      '状态：没有找到本地保存的账号数据'
    ]);

    notify('📭 暂无账号数据', STORE_KEY);
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

    notify('📭 暂无有效账号', '账号列表为空');
    $done({});
    return;
  }

  logBlock('📦 众安健康账号总览', [
    `存储 Key：${STORE_KEY}`,
    `账号数量：${list.length}`,
    `数据版本：${store.version || '未知'}`,
    `敏感信息显示：${SHOW_SENSITIVE ? '开启' : '关闭'}`
  ]);

  list.forEach((item, idx) => {
    const acc = item.acc || {};

    logBlock(`👤 账号 ${idx + 1}/${list.length}`, [
      `序号：${idx + 1}`,
      `id：${item.id}`,
      `别名：${acc.alias || '未命名'}`,
      acc.name ? `名称：${acc.name}` : '',
      acc.phone ? `手机号：${maskText(acc.phone)}` : '',
      acc.mobile ? `Mobile：${maskText(acc.mobile)}` : '',
      `Token：${maskText(acc.token) || '未保存'}`,
      `Cookie：${acc.cookie ? '已保存' : '未保存'}`,
      `Cookie 预览：${shortText(maskCookie(acc.cookie), 220)}`,
      acc.userId || acc.uid ? `用户ID：${acc.userId || acc.uid}` : '',
      acc.remark ? `备注：${acc.remark}` : '',
      acc.captureUrl ? `捕获 URL：${shortText(acc.captureUrl, 220)}` : '',
      `更新时间：${formatTime(acc.updatedAt)}`,
      acc.lastRunAt ? `最近任务：${formatTime(acc.lastRunAt)}` : '',
      acc.lastResult ? `最近结果：${shortText(JSON.stringify(acc.lastResult), 220)}` : ''
    ]);
  });

  if (SHOW_FULL_STORE_IN_LOG) {
    console.log('\n完整 store：');
    console.log(JSON.stringify(store, null, 2));
  }

  const notifyRows = list.map((item, idx) => {
    const acc = item.acc || {};

    return [
      `${idx + 1}. ${getDisplayName(item.id, acc)}`,
      `id: ${item.id}`,
      `Token: ${maskText(acc.token) || '未保存'}`,
      `Cookie: ${acc.cookie ? '已保存' : '未保存'}`,
      `更新时间: ${formatTime(acc.updatedAt)}`
    ].join('\n');
  });

  notify(
    `当前共 ${list.length} 个账号`,
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
      `存储 Key：${STORE_KEY}`,
      '状态：没有可删除的账号'
    ]);

    notify('📭 暂无账号', '没有可删除的账号');
    $done({});
    return;
  }

  const store = loaded.store;
  const list = buildList(store);

  if (!list.length) {
    logBlock('📭 暂无有效账号', [
      `存储 Key：${STORE_KEY}`,
      '状态：账号列表为空'
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
      alias: acc.alias || '未命名',
      name: acc.name || '',
      display: getDisplayName(item.id, acc)
    });

    delete store.accounts[item.id];
  }

  store.order = Array.isArray(store.order)
    ? store.order.filter(id => store.accounts[id])
    : Object.keys(store.accounts || {});

  saveStore(store);

  const remainList = buildList(store);
  const after = remainList.length;

  logBlock('🗑️ 已删除众安健康账号', [
    `删除数量：${deleted.length}`,
    `删除前账号数：${before}`,
    `删除后账号数：${after}`,
    '',
    ...deleted.map(x => `${x.index}. ${x.display} / id: ${x.id}`)
  ]);

  notify(
    `✅ 已删除 ${deleted.length} 个账号`,
    [
      ...deleted.map(x => `${x.index}. ${x.display}\nid: ${x.id}`),
      '',
      `剩余账号：${after}`
    ].join('\n\n')
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