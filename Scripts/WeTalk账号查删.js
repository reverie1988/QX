// 2026/05/06
/*
@Name：WeTalk 账号查删一体
@Description：
- 查询 Quantumult X $prefs 中保存的 WeTalk 账号数据
- 删除指定 WeTalk 账号
- 支持按序号 / 邮箱 / 账号 ID / 别名删除
- 默认隐藏敏感字段

本地 Key：
wetalk_accounts_v1

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
const DELETE_TARGETS = ['abc@gmail.com'];

删除全部：
const ACTION = 'delete';
const DELETE_ALL = true;
*/

const scriptName = 'WeTalk';
const storeKey = 'wetalk_accounts_v1';

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
// DELETE_TARGETS 优先级和 DELETE_INDEXES 同时生效。
const DELETE_TARGETS = [
  // 'abc@gmail.com',
  // 'fp_xxxxxxxxxxxx',
];

// 删除全部。
// ACTION = 'delete' 时生效，优先级最高。
const DELETE_ALL = false;

// 是否打印完整敏感信息。
// 不建议开启，可能包含 sign、Header、完整抓包 URL。
const SHOW_SENSITIVE = false;

// 查询时是否显示参数字段。
const SHOW_PARAMS = true;

// 查询时是否显示 Header 字段名。
const SHOW_HEADER_KEYS = true;

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
    `\n【${scriptName} ${nowTime()}】┌ ${title}\n` +
    body +
    `\n【${scriptName} ${nowTime()}】└────────────────────────────`
  );
}

function notify(title, body) {
  $notify(scriptName, title, body);
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

function formatTime(ts) {
  if (!ts) return '未知';

  const d = new Date(ts);

  if (isNaN(d.getTime())) {
    return String(ts);
  }

  return d.toLocaleString();
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

function maskText(text) {
  if (!text) return '';

  if (SHOW_SENSITIVE) {
    return String(text);
  }

  const s = String(text);

  if (s.includes('@')) {
    return maskEmail(s);
  }

  if (/^1\d{10}$/.test(s)) {
    return s.slice(0, 3) + '****' + s.slice(7);
  }

  if (s.length > 12) {
    return s.slice(0, 6) + '***' + s.slice(-6);
  }

  if (s.length > 6) {
    return s.slice(0, 3) + '***' + s.slice(-2);
  }

  return s;
}

function maskSensitiveText(text) {
  if (!text) return '';

  if (SHOW_SENSITIVE) {
    return String(text);
  }

  return String(text)
    .replace(/(sign=)[^&]+/gi, '$1***')
    .replace(/(signDate=)[^&]+/gi, '$1***')
    .replace(/(token=)[^&]+/gi, '$1***')
    .replace(/(access_token=)[^&]+/gi, '$1***')
    .replace(/(authorization=)[^&]+/gi, '$1***')
    .replace(/(password=)[^&]+/gi, '$1***')
    .replace(/(secret=)[^&]+/gi, '$1***')
    .replace(/("sign"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("signDate"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("token"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("access_token"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("Authorization"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("authorization"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("password"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("secret"\s*:\s*")[^"]+/gi, '$1***');
}

function loadStore() {
  const raw = $prefs.valueForKey(storeKey);

  if (!raw) {
    return {
      ok: true,
      empty: true,
      raw: '',
      store: {
        version: 2,
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
  return $prefs.setValueForKey(JSON.stringify(store), storeKey);
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
  const targetSet = DELETE_TARGETS
    .map(v => String(v || '').trim().toLowerCase())
    .filter(Boolean);

  if (!targetSet.length) {
    return [];
  }

  const indexes = [];

  list.forEach((item, idx) => {
    const candidates = recordCandidates(item.id, item.acc);

    if (targetSet.some(t => candidates.includes(t))) {
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

function renderAccount(item, index, detail) {
  const id = item.id;
  const acc = item.acc || {};
  const capture = acc.capture || {};
  const paramsRaw = capture.paramsRaw || {};
  const headers = capture.headers || {};

  let userAgent = acc.baseUA || '';

  if (!userAgent && headers && typeof headers === 'object') {
    Object.keys(headers).forEach(k => {
      if (String(k).toLowerCase() === 'user-agent') {
        userAgent = headers[k];
      }
    });
  }

  const paramKeys = Object.keys(paramsRaw || {});
  const headerKeys = Object.keys(headers || {});

  const rows = [
    `${index}. ${acc.email || acc.alias || id}`,
    `   账号 ID：${id}`,
    `   邮箱：${acc.email ? maskEmail(acc.email) : '未记录'}`,
    `   别名：${acc.alias || '未记录'}`,
    `   UA Seed：${typeof acc.uaSeed !== 'undefined' ? acc.uaSeed : '未记录'}`,
    `   创建时间：${formatTime(acc.createdAt)}`,
    `   更新时间：${formatTime(acc.updatedAt)}`
  ];

  if (detail) {
    rows.push(`   参数数量：${paramKeys.length}`);
    rows.push(`   Header 数量：${headerKeys.length}`);
    rows.push(`   User-Agent：${shortText(userAgent || '未记录', 180)}`);
    rows.push(`   原始 URL：${capture.url ? shortText(maskSensitiveText(capture.url), 280) : '未记录'}`);

    if (SHOW_HEADER_KEYS && headerKeys.length) {
      rows.push(`   Header 字段：${headerKeys.join(', ')}`);
    }

    if (SHOW_PARAMS && paramKeys.length) {
      rows.push('   参数字段：');

      paramKeys.forEach(k => {
        let value = paramsRaw[k];

        if (!SHOW_SENSITIVE && /sign|token|auth|password|secret/i.test(k)) {
          value = '***';
        }

        rows.push(`     - ${k}：${shortText(value, 120)}`);
      });
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
      `存储 Key：${storeKey}`,
      '原因：JSON 解析失败',
      `原始数据预览：${shortText(maskSensitiveText(loaded.raw), 500)}`
    ]);

    notify('❌ 数据解析失败', `请检查 ${storeKey}`);
    $done({});
    return;
  }

  if (loaded.empty) {
    logBlock('📭 暂无 WeTalk 账号数据', [
      `存储 Key：${storeKey}`,
      '状态：未发现已保存账号'
    ]);

    notify('📭 暂无账号数据', '当前没有保存的 WeTalk 账号');
    $done({});
    return;
  }

  const store = loaded.store;
  const list = buildList(store);

  if (!list.length) {
    logBlock('📭 暂无有效账号', [
      `存储 Key：${storeKey}`,
      '状态：存在存储数据，但账号列表为空'
    ]);

    notify('📭 暂无有效账号', '账号列表为空');
    $done({});
    return;
  }

  logBlock('📦 WeTalk 账号数据总览', [
    `存储 Key：${storeKey}`,
    `账号数量：${list.length}`,
    `数据版本：${store.version || '未知'}`,
    `敏感信息显示：${SHOW_SENSITIVE ? '开启' : '关闭'}`,
    `参数字段显示：${SHOW_PARAMS ? '开启' : '关闭'}`,
    `Header 字段显示：${SHOW_HEADER_KEYS ? '开启' : '关闭'}`
  ]);

  list.forEach((item, idx) => {
    const acc = item.acc || {};
    const capture = acc.capture || {};
    const paramsRaw = capture.paramsRaw || {};
    const headers = capture.headers || {};

    let userAgent = acc.baseUA || '';

    if (!userAgent && headers && typeof headers === 'object') {
      Object.keys(headers).forEach(k => {
        if (String(k).toLowerCase() === 'user-agent') {
          userAgent = headers[k];
        }
      });
    }

    const paramKeys = Object.keys(paramsRaw || {});
    const headerKeys = Object.keys(headers || {});

    logBlock(`👤 账号 ${idx + 1}/${list.length}`, [
      `序号：${idx + 1}`,
      `账号 ID：${item.id}`,
      `邮箱：${acc.email || '未记录'}`,
      `别名：${acc.alias || '未记录'}`,
      `UA Seed：${typeof acc.uaSeed !== 'undefined' ? acc.uaSeed : '未记录'}`,
      `创建时间：${formatTime(acc.createdAt)}`,
      `更新时间：${formatTime(acc.updatedAt)}`,
      `参数数量：${paramKeys.length}`,
      `Header 数量：${headerKeys.length}`,
      `User-Agent：${shortText(userAgent || '未记录', 180)}`,
      `原始 URL：${capture.url ? shortText(maskSensitiveText(capture.url), 280) : '未记录'}`
    ]);

    if (SHOW_HEADER_KEYS && headerKeys.length) {
      logBlock(`🧾 账号 ${idx + 1} Header 字段`, headerKeys);
    }

    if (SHOW_PARAMS && paramKeys.length) {
      const rows = paramKeys.map(k => {
        let value = paramsRaw[k];

        if (!SHOW_SENSITIVE && /sign|token|auth|password|secret/i.test(k)) {
          value = '***';
        }

        return `${k}：${shortText(value, 120)}`;
      });

      logBlock(`🔎 账号 ${idx + 1} 参数字段`, rows);
    }
  });

  if (SHOW_FULL_STORE_IN_LOG) {
    console.log('\n完整 store：');
    console.log(JSON.stringify(store, null, 2));
  }

  notify(
    `📦 当前共 ${list.length} 个账号`,
    list.map((item, idx) => {
      const acc = item.acc || {};
      return `${idx + 1}. ${acc.email || acc.alias || item.id}`;
    }).join('\n')
  );

  $done({});
}

function deleteStore() {
  const loaded = loadStore();

  if (!loaded.ok) {
    logBlock('❌ 删除失败', [
      `存储 Key：${storeKey}`,
      '原因：账号数据 JSON 解析失败',
      `原始数据预览：${shortText(maskSensitiveText(loaded.raw), 500)}`
    ]);

    notify('❌ 删除失败', '账号数据解析失败');
    $done({});
    return;
  }

  if (loaded.empty) {
    logBlock('📭 没有账号数据', [
      `存储 Key：${storeKey}`,
      '状态：无需删除'
    ]);

    notify('📭 没有账号数据', '当前没有保存的 WeTalk 账号');
    $done({});
    return;
  }

  const store = loaded.store;
  const list = buildList(store);

  if (!list.length) {
    logBlock('📭 没有有效账号', [
      `存储 Key：${storeKey}`,
      '状态：账号列表为空'
    ]);

    notify('📭 没有有效账号', '账号列表为空');
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
      '⚠️ 未找到要删除的账号',
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

  logBlock('🗑️ 已删除 WeTalk 账号', [
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
