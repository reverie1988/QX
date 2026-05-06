const scriptName = "🏢 众安健康";
const storeKey = "zajk_accounts_v1";

const raw = $prefs.valueForKey(storeKey);

if (!raw) {
  $notify(scriptName, "暂无账号数据", storeKey);
  console.log("暂无账号数据");
  $done();
} else {
  try {
    const store = JSON.parse(raw);
    const ids = (store.order || []).filter(id => store.accounts && store.accounts[id]);

    const msg = ids.map((id, index) => {
      const acc = store.accounts[id];

      return (
        `${index + 1}. ${acc.alias || "未命名"}\n` +
        `id: ${id}\n` +
        `Token: ${mask(acc.token)}\n` +
        `Cookie: ${acc.cookie ? "已保存" : "未保存"}\n` +
        `更新时间: ${new Date(acc.updatedAt).toLocaleString()}`
      );
    }).join("\n\n");

    $notify(scriptName, `当前共 ${ids.length} 个账号`, msg || "无账号");
    console.log(JSON.stringify(store, null, 2));
    $done();
  } catch (e) {
    $notify(scriptName, "❌ 数据解析失败", String(e.message || e));
    console.log(raw);
    $done();
  }
}

function mask(str) {
  str = String(str || "");
  if (str.length <= 12) return str ? "***" : "";
  return str.slice(0, 6) + "****" + str.slice(-4);
}