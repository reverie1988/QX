// 2026/05/05
/*
@Name：WeTalk 删除指定账号
@Description：
- 删除 Quantumult X $prefs 中保存的某一个 WeTalk 账号
- 支持按邮箱 / 账号ID / 序号删除

使用方法：
1. 先运行 WeTalk_ListAccounts.js 查看账号
2. 把 DELETE_TARGET 改成要删除的邮箱或账号 ID
3. 或者把 DELETE_INDEX 改成账号序号
4. 手动运行本脚本

注意：
- DELETE_TARGET 优先级高于 DELETE_INDEX
- DELETE_INDEX 从 1 开始
*/

const scriptName = 'WeTalk';
const storeKey = 'wetalk_accounts_v1';

/*
示例：
const DELETE_TARGET = 'abc@gmail.com';
const DELETE_TARGET = 'fp_xxxxxxxxxxxx';

如果用序号删除，则保持 DELETE_TARGET 为空：
const DELETE_TARGET = '';
const DELETE_INDEX = 1;
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
    `\n【${scriptName} ${nowTime()}】┌ ${title}\n` +
    body +
    `\n【${scriptName} ${nowTime()}】└────────────────────────────`
  );
}

function notify(title, body) {
  $notify(scriptName, title, body);
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function loadStore() {
  const raw = $prefs.valueForKey(storeKey);

  if (!raw) {
    return {
      ok: true,
      empty: true,
      store: {
        version: 2,
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
  $prefs.setValueForKey(JSON.stringify(store), storeKey);
}

function getIds(store) {
  return (store.order || []).filter(id => store.accounts && store.accounts[id]);
}

function findTargetId(store, target, index) {
  const ids = getIds(store);

  if (target) {
    const t = String(target).trim().toLowerCase();

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const acc = store.accounts[id] || {};

      const candidates = [
        id,
        acc.id,
        acc.email,
        acc.alias
      ].filter(Boolean).map(v => String(v).trim().toLowerCase());

      if (candidates.indexOf(t) >= 0) {
        return {
          id,
          index: i + 1,
          acc
        };
      }
    }

    return null;
  }

  if (index && index > 0 && index <= ids.length) {
    const id = ids[index - 1];
    return {
      id,
      index,
      acc: store.accounts[id]
    };
  }

  return null;
}

const loaded = loadStore();

if (!loaded.ok) {
  logBlock('❌ 删除失败', [
    `存储 Key：${storeKey}`,
    '原因：账号数据 JSON 解析失败'
  ]);

  notify('❌ 删除失败', '账号数据解析失败');
  $done();
} else if (loaded.empty) {
  logBlock('📭 没有账号数据', [
    `存储 Key：${storeKey}`,
    '状态：无需删除'
  ]);

  notify('📭 没有账号数据', '当前没有保存的 WeTalk 账号');
  $done();
} else {
  const store = loaded.store;
  const ids = getIds(store);

  if (!ids.length) {
    logBlock('📭 没有有效账号', [
      `存储 Key：${storeKey}`,
      '状态：账号列表为空'
    ]);

    notify('📭 没有有效账号', '账号列表为空');
    $done();
  } else {
    const found = findTargetId(store, DELETE_TARGET, DELETE_INDEX);

    if (!found) {
      const list = ids.map((id, i) => {
        const acc = store.accounts[id] || {};
        return `${i + 1}. ${acc.alias || acc.email || id}`;
      }).join('\n');

      logBlock('⚠️ 未找到要删除的账号', [
        `DELETE_TARGET：${DELETE_TARGET || '未填写'}`,
        `DELETE_INDEX：${DELETE_INDEX || '未填写'}`,
        `当前账号数：${ids.length}`,
        '请先运行查看脚本确认账号邮箱、ID 或序号',
        '',
        list
      ]);

      notify(
        '⚠️ 未找到要删除的账号',
        `请检查 DELETE_TARGET 或 DELETE_INDEX\n当前账号数：${ids.length}`
      );

      $done();
    } else {
      const acc = found.acc || {};
      const before = ids.length;

      delete store.accounts[found.id];

      store.order = (store.order || []).filter(id => id !== found.id);

      const after = getIds(store).length;

      saveStore(store);

      logBlock('🗑️ 已删除 WeTalk 账号', [
        `序号：${found.index}`,
        `账号 ID：${found.id}`,
        `邮箱：${acc.email || '未记录'}`,
        `别名：${acc.alias || '未记录'}`,
        `删除前账号数：${before}`,
        `删除后账号数：${after}`
      ]);

      notify(
        '🗑️ 已删除指定账号',
        `${acc.email || acc.alias || found.id}\n剩余账号：${after}`
      );

      $done();
    }
  }
}
