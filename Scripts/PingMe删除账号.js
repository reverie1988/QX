const scriptName = 'PingMe';
const storeKey = 'pingme_accounts_v1';

// 改成你通知里看到的 id
const DELETE_ID = '1459d1b42fbe'; // id

function loadStore() {
  const raw = $prefs.valueForKey(storeKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

const store = loadStore();

if (!store || !store.accounts) {
  $notify(scriptName, '⚠️ 没有账号数据', storeKey);
  $done();
} else if (!store.accounts[DELETE_ID]) {
  $notify(scriptName, '⚠️ 没找到该账号', DELETE_ID);
  $done();
} else {
  delete store.accounts[DELETE_ID];

  if (Array.isArray(store.order)) {
    store.order = store.order.filter(id => id !== DELETE_ID);
  }

  $prefs.setValueForKey(JSON.stringify(store), storeKey);

  $notify(scriptName, '✅ 已删除指定账号', DELETE_ID);
  console.log(`【${scriptName}】已删除账号 ${DELETE_ID}`);

  $done();
}

