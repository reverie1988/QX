// 2026/05/05
/*
@Name：GLaDOS 清空所有账号
@Description：清空 QX 本地保存的 GLaDOS 账号 Cookie 数据
*/

const SCRIPT_NAME = 'GLaDOS';
const STORE_KEY = 'glados_accounts_v1';

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

const raw = $prefs.valueForKey(STORE_KEY);
let count = 0;

if (raw) {
  const store = safeJsonParse(raw);

  if (store && store.accounts) {
    count = Object.keys(store.accounts).length;
  }
}

$prefs.removeValueForKey(STORE_KEY);

logBlock('🧹 GLaDOS 账号数据已清空', [
  `存储 Key：${STORE_KEY}`,
  `已删除账号数量：${count}`,
  '结果：清空完成'
]);

$notify(
  SCRIPT_NAME,
  '🧹 已清空所有账号',
  `已删除 ${count} 个账号\nKey：${STORE_KEY}`
);

$done();