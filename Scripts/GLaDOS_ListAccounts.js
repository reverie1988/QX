// 2026/05/05
/*
@Name：GLaDOS 查看本地账号
@Description：
- 只查看 QX 本地保存的 GLaDOS 账号
- 不进行网络查询
- 不执行签到
- 不执行兑换
*/

const SCRIPT_NAME = 'GLaDOS';
const STORE_KEY = 'glados_accounts_v1';

// 是否在日志中显示完整 Cookie
// 不建议开启，Cookie 属于敏感信息
const SHOW_COOKIE_IN_LOG = false;

// ========== 工具函数 ==========

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

function shortText(text, maxLen) {
  if (!text) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}

function formatNumber(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback || '未知';
  }

  const n = Number(value);

  if (isNaN(n)) {
    return fallback || '未知';
  }

  return String(parseInt(n, 10));
}

function formatDays(value) {
  return formatNumber(value, '未知');
}

function formatPoints(value) {
  return formatNumber(value, '未知');
}

function maskCookie(cookie) {
  if (!cookie) return '未保存';

  if (SHOW_COOKIE_IN_LOG) {
    return String(cookie);
  }

  return String(cookie)
    .replace(/(koa:sess=)[^;]+/gi, '$1***')
    .replace(/(koa:sess\.sig=)[^;]+/gi, '$1***')
    .replace(/(token=)[^;]+/gi, '$1***')
    .replace(/(session=)[^;]+/gi, '$1***');
}

function formatTime(ts) {
  if (!ts) return '未知';

  try {
    return new Date(ts).toLocaleString();
  } catch (e) {
    return '未知';
  }
}

// ========== 本地存储 ==========

function loadStore() {
  const raw = $prefs.valueForKey(STORE_KEY);

  if (!raw) {
    return {
      ok: true,
      empty: true,
      raw: '',
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
      raw,
      store: null
    };
  }

  if (!store.accounts) {
    store.accounts = {};
  }

  if (!Array.isArray(store.order)) {
    store.order = Object.keys(store.accounts);
  }

  return {
    ok: true,
    empty: false,
    raw,
    store
  };
}

function getIds(store) {
  return (store.order || []).filter(id => store.accounts && store.accounts[id]);
}

// ========== 主程序 ==========

function main() {
  const loaded = loadStore();

  if (!loaded.ok) {
    logBlock('❌ 本地数据解析失败', [
      `存储 Key：${STORE_KEY}`,
      '原因：JSON 解析失败',
      `原始数据预览：${shortText(loaded.raw || '', 500)}`
    ]);

    $notify(
      SCRIPT_NAME,
      '❌ 本地数据解析失败',
      `请检查 ${STORE_KEY}`
    );

    $done();
    return;
  }

  if (loaded.empty) {
    logBlock('📭 暂无 GLaDOS 本地账号', [
      `存储 Key：${STORE_KEY}`,
      '状态：没有找到本地保存的账号数据',
      '提示：请先通过浏览器自动提取 Cookie'
    ]);

    $notify(
      SCRIPT_NAME,
      '📭 暂无本地账号',
      '请先用 Safari / Edge / Chrome 登录 GLaDOS 并触发抓取'
    );

    $done();
    return;
  }

  const store = loaded.store;
  const ids = getIds(store);

  if (!ids.length) {
    logBlock('📭 暂无有效账号', [
      `存储 Key：${STORE_KEY}`,
      '状态：存在本地数据，但账号列表为空'
    ]);

    $notify(
      SCRIPT_NAME,
      '📭 暂无有效账号',
      '本地账号列表为空'
    );

    $done();
    return;
  }

  logBlock('📦 GLaDOS 本地账号总览', [
    `存储 Key：${STORE_KEY}`,
    `账号数量：${ids.length}`,
    `数据版本：${store.version || '未知'}`,
    '网络查询：关闭',
    `Cookie 显示：${SHOW_COOKIE_IN_LOG ? '完整显示' : '已隐藏'}`
  ]);

  const notifyRows = [];

  ids.forEach((id, index) => {
    const acc = store.accounts[id] || {};

    const email = acc.email || acc.alias || id || '未知账号';
    const hasCookie = acc.cookie ? '已保存' : '未保存';

    logBlock(`👤 账号 ${index + 1}/${ids.length}`, [
      `序号：${index + 1}`,
      `账号 ID：${id}`,
      `邮箱：${acc.email || '未获取'}`,
      `别名：${acc.alias || '未设置'}`,
      `Cookie：${hasCookie}`,
      `Cookie 预览：${shortText(maskCookie(acc.cookie), 220)}`,
      `剩余天数：${formatDays(acc.leftDays)} 天`,
      `积分：${formatPoints(acc.points)}`,
      `创建时间：${formatTime(acc.createdAt)}`,
      `更新时间：${formatTime(acc.updatedAt)}`,
      `最近查询：${formatTime(acc.lastQueryAt)}`,
      `最近任务：${formatTime(acc.lastTaskAt)}`
    ]);

    notifyRows.push(
      `${index + 1}. ${email}\n` +
      `Cookie：${hasCookie}\n` +
      `剩余：${formatDays(acc.leftDays)} 天｜积分：${formatPoints(acc.points)}`
    );
  });

  $notify(
    SCRIPT_NAME,
    `📦 本地共 ${ids.length} 个账号`,
    notifyRows.join('\n\n')
  );

  $done();
}

main();