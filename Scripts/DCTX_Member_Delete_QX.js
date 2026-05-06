// 2026/05/06
/*
项目: 大潮
名称: 删除本地 member
用途: 按账号删除 Quantumult X 本地保存的 member。

QX task 示例：
0 9 * * * DCTX_Member_Delete_QX.js, tag=大潮member删除, enabled=false
*/

const SCRIPT_NAME = '大潮 member 删除';
const STORE_KEY = 'dctx_member_store_v1';
const LAST_KEY = 'dctx_member_last_v1';

// 在这里填写要删除的账号，可填手机号、ID、key。
// 留空时只列出当前已保存账号，不删除。
const DELETE_TARGETS = [
  // '13800138000',
  // '123456',
];

// 删除全部请改成 true。优先级高于 DELETE_TARGETS。
const DELETE_ALL = false;

function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(text); } catch (e) { return fallback; }
}

function maskPhone(phone) {
  const s = String(phone || '');
  if (/^\d{11}$/.test(s)) return s.slice(0, 3) + '****' + s.slice(7);
  if (s.length > 6) return s.slice(0, 3) + '****' + s.slice(-3);
  return s || '未知';
}

function loadStore() {
  const raw = $prefs.valueForKey(STORE_KEY);
  const obj = safeJsonParse(raw, { version: 1, updatedAt: '', accounts: {} });
  if (!obj || typeof obj !== 'object') return { version: 1, updatedAt: '', accounts: {} };
  if (!obj.accounts || typeof obj.accounts !== 'object') obj.accounts = {};
  return obj;
}

function saveStore(store) {
  store.version = 1;
  store.updatedAt = new Date().toLocaleString();
  return $prefs.setValueForKey(JSON.stringify(store), STORE_KEY);
}

function recordValues(rec) {
  return [rec.key, rec.phone, rec.mobile, rec.id].map(v => String(v || '').trim()).filter(Boolean);
}

function main() {
  const store = loadStore();
  const keys = Object.keys(store.accounts || {});
  const list = keys.map(k => store.accounts[k]).filter(Boolean);

  if (list.length === 0) {
    const msg = `当前没有本地 member 记录\n本地 Key：${STORE_KEY}`;
    console.log(`\n【${SCRIPT_NAME}】${msg}`);
    $notify('🌟 大潮 member 删除', '无记录', msg);
    return;
  }

  const targets = DELETE_TARGETS.map(v => String(v).trim()).filter(Boolean);

  if (!DELETE_ALL && targets.length === 0) {
    const msg = [
      '未填写 DELETE_TARGETS，本次不会删除。',
      '当前可删除账号：',
      ...list.map((rec, idx) => `${idx + 1}. ${maskPhone(rec.key)} / ID: ${rec.id || '未知'} / 更新时间: ${rec.updatedAt || '未知'}`),
      '',
      '需要删除哪个账号，就把手机号或 ID 填进 DELETE_TARGETS。'
    ].join('\n');
    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $notify('🌟 大潮 member 删除', '请选择账号', msg);
    return;
  }

  const deleted = [];

  for (const key of keys) {
    const rec = store.accounts[key];
    if (!rec) continue;

    const shouldDelete = DELETE_ALL || targets.some(t => recordValues(rec).includes(t));
    if (shouldDelete) {
      deleted.push(`${maskPhone(rec.key || key)} / ID: ${rec.id || '未知'}`);
      delete store.accounts[key];
    }
  }

  if (deleted.length === 0) {
    const msg = [
      `未匹配到要删除的账号：${targets.join('、')}`,
      '当前已保存账号：',
      ...list.map((rec, idx) => `${idx + 1}. ${maskPhone(rec.key)} / ID: ${rec.id || '未知'}`)
    ].join('\n');
    console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
    $notify('🌟 大潮 member 删除', '未匹配到账号', msg);
    return;
  }

  saveStore(store);

  const remainKeys = Object.keys(store.accounts || {});
  if (remainKeys.length === 0) {
    $prefs.removeValueForKey(LAST_KEY);
  } else {
    const first = store.accounts[remainKeys[0]];
    if (first && first.raw) {
      $prefs.setValueForKey(JSON.stringify({
        key: first.key || remainKeys[0],
        updatedAt: first.updatedAt || '',
        raw: first.raw
      }), LAST_KEY);
    }
  }

  const remain = remainKeys.length;
  const msg = [
    `已删除 ${deleted.length} 个账号 member：`,
    ...deleted,
    '',
    `剩余：${remain} 个`
  ].join('\n');
  console.log(`\n【${SCRIPT_NAME}】\n${msg}`);
  $notify('🌟 大潮 member 删除', `已删除 ${deleted.length} 个`, msg);
}

try { main(); } catch (e) {
  const err = e && e.message ? e.message : String(e);
  console.log(`【${SCRIPT_NAME}】脚本异常：${err}`);
  $notify('🌟 大潮 member 删除', '脚本异常', err);
}

$done({});