// 2026/05/05
/*
项目: 大潮
名称: member 提取器
用途: 从请求头中提取 member 数据并保存到 QX $prefs

推荐 snippet 写法：

hostname = m.aihoge.com

^https:\/\/m\.aihoge\.com\/api\/publichy\/client\/activity\/info\?source=wechat url script-request-header https://raw.githubusercontent.com/reverie1988/Scripts/main/QX/DCTX.js
*/

const SCRIPT_NAME = '大潮 member 提取器';
const STORAGE_KEY = 'member_extractor_last_data_v2';
const HISTORY_KEY = 'member_extractor_history_v1';
const MAX_HISTORY = 10;

// 是否在日志里打印完整 member 数据。
// 不建议开启，member 可能包含账号相关敏感信息。
const SHOW_FULL_MEMBER_IN_LOG = false;

// 是否保存历史记录。
const SAVE_HISTORY = true;

function nowTime() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function log(msg) {
  console.log(`【${SCRIPT_NAME} ${nowTime()}】${msg}`);
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

function shortText(text, maxLen) {
  if (!text) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}

function maskMemberText(text) {
  if (!text) return '';

  if (SHOW_FULL_MEMBER_IN_LOG) {
    return String(text);
  }

  return String(text)
    .replace(/("token"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("access_token"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("auth"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("authorization"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("phone"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("mobile"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("password"\s*:\s*")[^"]+/gi, '$1***');
}

function getHeaderIgnoreCase(headers, name) {
  if (!headers) return '';

  const target = String(name).toLowerCase();

  for (const k in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, k)) {
      if (String(k).toLowerCase() === target) {
        return headers[k];
      }
    }
  }

  return '';
}

function loadHistory() {
  const raw = $prefs.valueForKey(HISTORY_KEY);

  if (!raw) return [];

  const arr = safeJsonParse(raw);
  return Array.isArray(arr) ? arr : [];
}

function saveHistory(item) {
  if (!SAVE_HISTORY) return;

  const history = loadHistory();

  const merged = [item].concat(history).filter((v, index, arr) => {
    if (!v || !v.raw) return false;
    return arr.findIndex(x => x && x.raw === v.raw) === index;
  });

  const limited = merged.slice(0, MAX_HISTORY);

  $prefs.setValueForKey(JSON.stringify(limited), HISTORY_KEY);
}

function notify(title, subtitle, body, copyText) {
  const option = {
    'media-url': 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f465.png'
  };

  if (copyText) {
    option.copy = copyText;
  }

  $notify(title, subtitle, body, option);
}

function extractMember() {
  if (typeof $request === 'undefined' || !$request || !$request.headers) {
    logBlock('❌ 环境错误', [
      '原因：没有检测到 $request.headers',
      '请确认 snippet 使用的是 script-request-header'
    ]);
    return;
  }

  const headers = $request.headers;
  const memberValue = getHeaderIgnoreCase(headers, 'member');

  if (!memberValue) {
    logBlock('⚠️ 未找到 member 请求头', [
      `请求 URL：${shortText($request.url || '未知', 260)}`,
      `Header 数量：${Object.keys(headers).length}`
    ]);
    return;
  }

  if (typeof memberValue !== 'string' || memberValue.trim() === '') {
    logBlock('⚠️ member 为空', [
      '状态：忽略本次请求'
    ]);
    return;
  }

  const parsedData = safeJsonParse(memberValue);

  if (!parsedData) {
    logBlock('❌ member 不是有效 JSON', [
      `member 预览：${shortText(maskMemberText(memberValue), 300)}`
    ]);

    notify(
      '🌟 大潮 member',
      '❌ JSON 解析失败',
      shortText(memberValue, 300),
      memberValue
    );

    return;
  }

  const lastData = $prefs.valueForKey(STORAGE_KEY);

  if (lastData === memberValue) {
    logBlock('⏸ 数据未变化', [
      `ID：${parsedData.id || '未知'}`,
      '状态：与上次保存数据完全相同，跳过通知'
    ]);
    return;
  }

  $prefs.setValueForKey(memberValue, STORAGE_KEY);

  const item = {
    id: parsedData.id || '',
    nickname: parsedData.nickname || parsedData.nickName || parsedData.name || '',
    phone: parsedData.phone || parsedData.mobile || '',
    time: new Date().toLocaleString(),
    raw: memberValue
  };

  saveHistory(item);

  logBlock('✅ 成功提取 member', [
    `ID：${parsedData.id || '未知'}`,
    `昵称：${item.nickname || '未知'}`,
    `时间：${item.time}`,
    `存储 Key：${STORAGE_KEY}`,
    `历史 Key：${HISTORY_KEY}`,
    `member 预览：${shortText(maskMemberText(memberValue), 300)}`
  ]);

  notify(
    '🌟 大潮 member 已提取',
    `ID: ${parsedData.id || '未知'}`,
    memberValue,
    memberValue
  );
}

// ========== 执行入口 ==========
try {
  extractMember();
} catch (e) {
  logBlock('❌ 脚本异常', [
    `错误：${e && e.message ? e.message : String(e)}`
  ]);
}

$done({});
