// 2026/05/05
/*
@Name：GLaDOS 删除指定账号
@Description：
- 按邮箱 / 账号 ID / 序号删除本地保存的 GLaDOS 账号
*/

const SCRIPT_NAME = 'GLaDOS';
const STORE_KEY = 'glados_accounts_v1';

/*
使用方法：

方式 1：按邮箱或账号 ID 删除
const DELETE_TARGET = 'example@gmail.com';

方式 2：按序号删除
const DELETE_TARGET = '';
const DELETE_INDEX = 1;

DELETE_TARGET 优先级高于 DELETE_INDEX。
DELETE_INDEX 从 1 开始。
*/
const DELETE_TARGET = '';
const DELETE_INDEX = 0;

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

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function loadStore() {
  const raw = $prefs.valueForKey(STORE_KEY);

  if (!raw) {
    return {
      ok: true,
      empty: true,
      store: {
        version: 1,
        accounts: {},
        order: []
      }
    };
  }

  const store = safeJsonParse(raw);

  if (!store) {
    return {
      ok: false,
      empty: false,
      store: null
    };
  }

  if (!store.accounts) store.accounts = {};
  if (!Array.isArray(store.order)) store.order = Object.keys(store.accounts);

  return {
    ok: true,
    empty: false,
    store
  };
}

function saveStore(store) {
  $prefs.setValueForKey(JSON.stringify(store), STORE_KEY);
}

function getIds(store) {
  return (store.order || []).filter(id => store.accounts && store.accounts[id]);
}

function findTarget(store) {
  const ids = getIds(store);

  if (DELETE_TARGET) {
    const target = String(DELETE_TARGET).trim().toLowerCase();

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const acc = store.accounts[id] || {};

      const candidates = [
        id,
        acc.id,
        acc.email,
        acc.alias
      ].filter(Boolean).map(v => String(v).trim().toLowerCase());

      if (candidates.indexOf(target) >= 0) {
        return {
          id,
          index: i + 1,
          account: acc
        };
      }
    }

    return null;
  }

  if (DELETE_INDEX > 0 && DELETE_INDEX <= ids.length) {
    const id = ids[DELETE_INDEX - 1];

    return {
      id,
      index: DELETE_INDEX,
      account: store.accounts[id]
    };
  }

  return null;
}

function main() {
  const loaded = loadStore();

  if (!loaded.ok) {
    logBlock('❌ 删除失败', [
      `存储 Key：${STORE_KEY}`,
      '原因：JSON 解析失败'
    ]);

    $notify(SCRIPT_NAME, '❌ 删除失败', '本地数据解析失败');
    $done();
    return;
  }

  if (loaded.empty) {
    logBlock('📭 暂无账号', [
      `存储 Key：${STORE_KEY}`
    ]);

    $notify(SCRIPT_NAME, '📭 暂无账号', '没有可删除的账号');
    $done();
    return;
  }

  const store = loaded.store;
  const ids = getIds(store);

  if (!ids.length) {
    logBlock('📭 暂无有效账号', [
      `存储 Key：${STORE_KEY}`
    ]);

    $notify(SCRIPT_NAME, '📭 暂无有效账号', '账号列表为空');
    $done();
    return;
  }

  const found = findTarget(store);

  if (!found) {
    const list = ids.map((id, i) => {
      const acc = store.accounts[id] || {};
      return `${i + 1}. ${acc.email || acc.alias || id}`;
    }).join('\n');

    logBlock('⚠️ 未找到要删除的账号', [
      `DELETE_TARGET：${DELETE_TARGET || '未填写'}`,
      `DELETE_INDEX：${DELETE_INDEX || '未填写'}`,
      `当前账号数：${ids.length}`,
      list
    ]);

    $notify(
      SCRIPT_NAME,
      '⚠️ 未找到账号',
      `请检查 DELETE_TARGET 或 DELETE_INDEX\n当前账号数：${ids.length}`
    );

    $done();
    return;
  }

  const before = ids.length;
  const acc = found.account || {};

  delete store.accounts[found.id];
  store.order = (store.order || []).filter(id => id !== found.id);

  const after = getIds(store).length;

  saveStore(store);

  logBlock('🗑️ 已删除 GLaDOS 账号', [
    `序号：${found.index}`,
    `账号 ID：${found.id}`,
    `邮箱：${acc.email || '未获取'}`,
    `删除前账号数：${before}`,
    `删除后账号数：${after}`
  ]);

  $notify(
    SCRIPT_NAME,
    '🗑️ 已删除指定账号',
    `${acc.email || acc.alias || found.id}\n剩余账号：${after}`
  );

  $done();
}

main();