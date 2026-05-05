// 2026/05/05
/*
@Name：WeTalk 清空所有账号
@Description：清空 Quantumult X $prefs 中保存的 WeTalk 账号数据
*/

const scriptName = 'WeTalk';
const storeKey = 'wetalk_accounts_v1';

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

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

const raw = $prefs.valueForKey(storeKey);
let count = 0;

if (raw) {
  const store = safeJsonParse(raw);
  if (store && store.accounts) {
    count = Object.keys(store.accounts).length;
  }
}

$prefs.removeValueForKey(storeKey);

logBlock('🧹 WeTalk 账号数据已清空', [
  `存储 Key：${storeKey}`,
  `已删除账号数量：${count}`,
  '结果：清空完成'
]);

$notify(
  scriptName,
  '🧹 已清空所有账号',
  `已删除 ${count} 个账号\nKey：${storeKey}`
);

$done();
