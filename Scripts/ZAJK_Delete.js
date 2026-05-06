const scriptName = "🏢 众安健康";
const storeKey = "zajk_accounts_v1";

// 优先按 ID 删除
const DELETE_ID = "";

// 如果 DELETE_ID 留空，则按查询列表里的序号删除
const DELETE_INDEX = 1;

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
  $notify(scriptName, "⚠️ 没有账号数据", storeKey);
  $done();
} else {
  const ids = (store.order || []).filter(id => store.accounts[id]);

  let targetId = "";

  if (DELETE_ID) {
    targetId = DELETE_ID;
  } else {
    const index = Number(DELETE_INDEX) - 1;
    targetId = ids[index] || "";
  }

  if (!targetId) {
    const list = ids.map((id, index) => {
      const acc = store.accounts[id];
      return `${index + 1}. ${acc.alias || "未命名"}\nid: ${id}`;
    }).join("\n\n");

    $notify(scriptName, "⚠️ 未指定有效账号", list || "暂无账号");
    $done();
  } else if (!store.accounts[targetId]) {
    $notify(scriptName, "⚠️ 没找到该账号", targetId);
    $done();
  } else {
    const deleted = store.accounts[targetId];

    delete store.accounts[targetId];

    if (Array.isArray(store.order)) {
      store.order = store.order.filter(id => id !== targetId);
    }

    store.updatedAt = Date.now();

    $prefs.setValueForKey(JSON.stringify(store), storeKey);

    $notify(
      scriptName,
      "✅ 已删除指定账号",
      `${deleted.alias || "未命名"}\nid: ${targetId}`
    );

    console.log(`【${scriptName}】已删除账号 ${targetId}`);

    $done();
  }
}