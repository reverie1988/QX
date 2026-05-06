// 2026/05/06
/*
项目: 大潮
名称: 查询本地 member
用途: 查询 Quantumult X 本地保存的 member 数据。

QX task 示例：
0 9 * * * DCTX_Member_Query_QX.js, tag=大潮member查询, enabled=false
*/

const SCRIPT_NAME = '大潮 member 查询';
const STORE_KEY = 'dctx_member_store_v1';

// 留空查询全部；填写手机号/ID/key 只查询指定账号。
const QUERY_TARGETS = [
  // '13800138000',
  // '123456',
];

// 是否显示完整 member。敏感信息，默认关闭。
const SHOW_FULL_MEMBER = false;

function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(text); } catch (e) { return fallback; }
}

function maskPhone(phone) {
  const s = String(phone || '');
  if (/^\d{11}$/.test(s)) return s.slice(0, 3) + '****' + s.slice(7);
  if (s.length > 6) return s.slice(0, 3) + '****' + s.slice(-3);
  return s || '未知';
}

function shortText(text, maxLen) {
  if (!text) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}

function maskMemberText(text) {
  if (!text) return '';
  if (SHOW_FULL_MEMBER) return String(text);
  return String(text)
    .replace(/("token"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("access_token"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("auth"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("authorization"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("btoken"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("mtoken"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("stoken"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("phone"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("mobile"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("password"\s*:\s*")[^"]+/gi, '$1***');
}

function loadStore() {
  const raw = $prefs.valueForKey(STORE_KEY);
  const obj = safeJsonParse(raw, { accounts: {} });
  if (!obj || typeof obj !== 'object' || !obj.accounts) return { accounts: {} };
  return obj;
}

function matchRecord(rec, targets) {
  if (!targets || targets.length === 0) return true;
  const values = [rec.key, rec.phone, rec.mobile, rec.id].map(v => String(v || '').trim());
  return targets.some(t => values.includes(String(t || '').trim()));
}

function main() {
  const store = loadStore();
  const list = Object.keys(store.accounts || {}).map(k => store.accounts[k]).filter(Boolean);
  const targets = QUERY_TARGETS.map(v => String(v).trim()).filter(Boolean);
  const selected = list.filter(rec => matchRecord(rec, targets));

  if (selected.length === 0) {
    const msg = list.length === 0
      ? `未找到本地 member\n本地 Key：${STORE_KEY}`
      : `未匹配到指定账号\n当前已保存：${list.map(x => maskPhone(x.key)).join('、')}`;
    console.log(`\n【${SCRIPT_NAME}】${msg}`);
    $notify('🌟 大潮 member 查询', '未找到记录', msg);
    return;
  }

  const blocks = selected.map((rec, idx) => {
    const parsed = safeJsonParse(rec.raw, {});
    return [
      `【${idx + 1}】账号：${maskPhone(rec.key)}`,
      `ID：${rec.id || parsed.id || '未知'}`,
      `昵称：${rec.nickname || parsed.nick_name || parsed.nickname || '未知'}`,
      `来源：${rec.source || parsed.source || '未知'}`,
      `过期：${rec.expire || parsed.expire || '未知'}`,
      `更新时间：${rec.updatedAt || '未知'}`,
      `历史数量：${Array.isArray(rec.history) ? rec.history.length : 0}`,
      `member：${shortText(maskMemberText(rec.raw), SHOW_FULL_MEMBER ? 3000 : 260)}`
    ].join('\n');
  });

  const output = blocks.join('\n\n------------------------------\n\n');
  console.log(`\n【${SCRIPT_NAME}】\n${output}`);
  $notify('🌟 大潮 member 查询', `共 ${selected.length} 个账号`, output);
}

try { main(); } catch (e) {
  const err = e && e.message ? e.message : String(e);
  console.log(`【${SCRIPT_NAME}】脚本异常：${err}`);
  $notify('🌟 大潮 member 查询', '脚本异常', err);
}

$done({});