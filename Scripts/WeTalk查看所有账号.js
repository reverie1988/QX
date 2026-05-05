// 2026/05/05
/*
@Name：WeTalk 查看所有账号
@Description：
- 查看 Quantumult X $prefs 中保存的 WeTalk 账号数据
- 打印账号 ID、邮箱、别名、更新时间
- 默认隐藏敏感字段
*/

const scriptName = 'WeTalk';
const storeKey = 'wetalk_accounts_v1';

// 是否打印完整敏感信息。
// 不建议开启，可能包含 sign、Header、完整抓包 URL。
const SHOW_SENSITIVE = false;

// 是否打印参数字段。
// 如果只想看账号列表，可以改成 false。
const SHOW_PARAMS = true;

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

function shortText(text, maxLen) {
  if (!text) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}

function formatTime(ts) {
  if (!ts) return '未知';

  try {
    return new Date(ts).toLocaleString();
  } catch (e) {
    return '未知';
  }
}

function maskText(text) {
  if (!text) return '';
  if (SHOW_SENSITIVE) return String(text);

  return String(text)
    .replace(/(sign=)[^&]+/gi, '$1***')
    .replace(/(signDate=)[^&]+/gi, '$1***')
    .replace(/(token=)[^&]+/gi, '$1***')
    .replace(/(access_token=)[^&]+/gi, '$1***')
    .replace(/(authorization=)[^&]+/gi, '$1***')
    .replace(/(password=)[^&]+/gi, '$1***')
    .replace(/(secret=)[^&]+/gi, '$1***')
    .replace(/("sign"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("signDate"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("Authorization"\s*:\s*")[^"]+/gi, '$1***')
    .replace(/("authorization"\s*:\s*")[^"]+/gi, '$1***');
}

function loadStore() {
  const raw = $prefs.valueForKey(storeKey);

  if (!raw) {
    return {
      ok: true,
      empty: true,
      raw: '',
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
      raw,
      store: null
    };
  }

  if (!store.accounts) store.accounts = {};
  if (!Array.isArray(store.order)) store.order = Object.keys(store.accounts);

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

const loaded = loadStore();

if (!loaded.ok) {
  logBlock('❌ 数据解析失败', [
    `存储 Key：${storeKey}`,
    '原因：JSON 解析失败',
    `原始数据预览：${shortText(maskText(loaded.raw), 500)}`
  ]);

  notify('❌ 数据解析失败', `请检查 ${storeKey}`);
  $done();
} else if (loaded.empty) {
  logBlock('📭 暂无 WeTalk 账号数据', [
    `存储 Key：${storeKey}`,
    '状态：未发现已保存账号'
  ]);

  notify('📭 暂无账号数据', '当前没有保存的 WeTalk 账号');
  $done();
} else {
  const store = loaded.store;
  const ids = getIds(store);

  if (!ids.length) {
    logBlock('📭 暂无有效账号', [
      `存储 Key：${storeKey}`,
      '状态：存在存储数据，但账号列表为空'
    ]);

    notify('📭 暂无有效账号', '账号列表为空');
    $done();
  } else {
    logBlock('📦 WeTalk 账号数据总览', [
      `存储 Key：${storeKey}`,
      `账号数量：${ids.length}`,
      `数据版本：${store.version || '未知'}`,
      `敏感信息显示：${SHOW_SENSITIVE ? '开启' : '关闭'}`,
      `参数字段显示：${SHOW_PARAMS ? '开启' : '关闭'}`
    ]);

    const notifyRows = [];

    ids.forEach((id, index) => {
      const acc = store.accounts[id] || {};
      const capture = acc.capture || {};
      const paramsRaw = capture.paramsRaw || {};
      const headers = capture.headers || {};

      let userAgent = acc.baseUA || '';

      if (!userAgent) {
        Object.keys(headers).forEach(k => {
          if (String(k).toLowerCase() === 'user-agent') {
            userAgent = headers[k];
          }
        });
      }

      const paramKeys = Object.keys(paramsRaw);
      const headerKeys = Object.keys(headers);

      logBlock(`👤 账号 ${index + 1}/${ids.length}`, [
        `序号：${index + 1}`,
        `账号 ID：${id}`,
        `邮箱：${acc.email || '未记录'}`,
        `别名：${acc.alias || '未记录'}`,
        `UA Seed：${typeof acc.uaSeed !== 'undefined' ? acc.uaSeed : '未记录'}`,
        `创建时间：${formatTime(acc.createdAt)}`,
        `更新时间：${formatTime(acc.updatedAt)}`,
        `参数数量：${paramKeys.length}`,
        `Header 数量：${headerKeys.length}`,
        `User-Agent：${shortText(userAgent || '未记录', 180)}`,
        `原始 URL：${capture.url ? shortText(maskText(capture.url), 280) : '未记录'}`
      ]);

      if (SHOW_PARAMS && paramKeys.length) {
        const rows = paramKeys.map(k => {
          let value = paramsRaw[k];

          if (!SHOW_SENSITIVE) {
            if (/sign|token|auth|password|secret/i.test(k)) {
              value = '***';
            }
          }

          return `${k}：${shortText(value, 120)}`;
        });

        logBlock(`🔎 账号 ${index + 1} 参数字段`, rows);
      }

      notifyRows.push(`${index + 1}. ${acc.email || acc.alias || id}`);
    });

    notify(
      `📦 当前共 ${ids.length} 个账号`,
      notifyRows.join('\n')
    );

    $done();
  }
}
