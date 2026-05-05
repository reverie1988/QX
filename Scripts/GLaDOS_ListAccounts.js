// 2026/05/05
/*
@Name：GLaDOS 查看本地账号
@Description：
- 查看 QX 本地保存的 GLaDOS 账号
- 可查询剩余天数和积分
- 不执行签到，不执行兑换
*/

const SCRIPT_NAME = 'GLaDOS';
const STORE_KEY = 'glados_accounts_v1';

const QUERY_REMOTE_STATUS = true;
const SHOW_COOKIE_IN_LOG = false;

const STATUS_URL = 'https://glados.cloud/api/user/status';
const POINTS_URL = 'https://glados.cloud/api/user/points';

const HEADERS_TEMPLATE = {
  'Referer': 'https://glados.cloud/console/checkin',
  'Origin': 'https://glados.cloud',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  'Accept': 'application/json, text/plain, */*'
};

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

function maskCookie(cookie) {
  if (!cookie) return '';
  if (SHOW_COOKIE_IN_LOG) return String(cookie);

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

function loadStore() {
  const raw = $prefs.valueForKey(STORE_KEY);

  if (!raw) {
    return {
      ok: true,
      empty: true,
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
      store: null
    };
  }

  if (!store.accounts) store.accounts = {};
  if (!Array.isArray(store.order)) store.order = Object.keys(store.accounts);

  return {
    ok: true,
    empty: false,
    store
  };
}

function saveStore(store) {
  $prefs.setValueForKey(JSON.stringify(store), STORE_KEY);
}

function getIds(store) {
  return (store.order || []).filter(id => store.accounts && store.accounts[id]);
}

function makeRequest(url, cookie) {
  const headers = Object.assign({}, HEADERS_TEMPLATE, {
    'Cookie': cookie
  });

  return $task.fetch({
    url: url,
    method: 'GET',
    headers: headers
  }).then(res => {
    return {
      ok: true,
      statusCode: res.statusCode || res.status || 0,
      body: res.body || ''
    };
  }).catch(err => {
    return {
      ok: false,
      error: err && err.error ? err.error : String(err)
    };
  });
}

function queryAccount(acc) {
  const result = {
    email: acc.email || '',
    leftDays: acc.leftDays,
    points: acc.points,
    error: ''
  };

  return makeRequest(STATUS_URL, acc.cookie).then(statusRes => {
    if (!statusRes.ok) {
      result.error = '状态查询失败：' + statusRes.error;
      return result;
    }

    const statusJson = safeJsonParse(statusRes.body);

    if (statusJson && statusJson.data) {
      result.email = statusJson.data.email || result.email;
      result.leftDays = statusJson.data.leftDays;
    }

    return makeRequest(POINTS_URL, acc.cookie);
  }).then(pointsRes => {
    if (pointsRes && pointsRes.ok) {
      const pointsJson = safeJsonParse(pointsRes.body);

      if (pointsJson && pointsJson.points !== undefined) {
        result.points = pointsJson.points;
      }
    }

    return result;
  }).catch(e => {
    result.error = e && e.message ? e.message : String(e);
    return result;
  });
}

function updateAccountFromQuery(store, id, q) {
  const acc = store.accounts[id];

  if (!acc) return;

  if (q.email) {
    acc.email = String(q.email).trim().toLowerCase();
    acc.alias = acc.alias || acc.email;
  }

  if (q.leftDays !== undefined) acc.leftDays = q.leftDays;
  if (q.points !== undefined) acc.points = q.points;

  acc.lastQueryAt = Date.now();
  acc.updatedAt = Date.now();
}

function main() {
  const loaded = loadStore();

  if (!loaded.ok) {
    logBlock('❌ 数据解析失败', [
      `存储 Key：${STORE_KEY}`,
      '原因：JSON 解析失败'
    ]);

    $notify(SCRIPT_NAME, '❌ 数据解析失败', STORE_KEY);
    $done();
    return;
  }

  if (loaded.empty) {
    logBlock('📭 暂无 GLaDOS 账号', [
      `存储 Key：${STORE_KEY}`,
      '请先在 Safari / Edge / Chrome 中登录 glados.cloud 并打开控制台页面'
    ]);

    $notify(SCRIPT_NAME, '📭 暂无账号', '请先通过浏览器登录 GLaDOS');
    $done();
    return;
  }

  const store = loaded.store;
  const ids = getIds(store);

  if (!ids.length) {
    logBlock('📭 暂无有效账号', [
      `存储 Key：${STORE_KEY}`,
      '账号列表为空'
    ]);

    $notify(SCRIPT_NAME, '📭 暂无有效账号', '账号列表为空');
    $done();
    return;
  }

  logBlock('📦 GLaDOS 本地账号总览', [
    `账号数量：${ids.length}`,
    `远程查询：${QUERY_REMOTE_STATUS ? '开启' : '关闭'}`,
    `存储 Key：${STORE_KEY}`
  ]);

  const notifyRows = [];
  let chain = Promise.resolve();

  ids.forEach((id, index) => {
    chain = chain.then(() => {
      const acc = store.accounts[id];

      if (!QUERY_REMOTE_STATUS) {
        return {
          email: acc.email || '',
          leftDays: acc.leftDays,
          points: acc.points,
          error: ''
        };
      }

      return queryAccount(acc);
    }).then(q => {
      updateAccountFromQuery(store, id, q);

      const acc = store.accounts[id];

      logBlock(`👤 账号 ${index + 1}/${ids.length}`, [
        `序号：${index + 1}`,
        `账号 ID：${id}`,
        `邮箱：${acc.email || '未获取'}`,
        `剩余天数：${acc.leftDays !== undefined ? acc.leftDays : '未获取'}`,
        `积分：${acc.points !== undefined ? acc.points : '未获取'}`,
        `创建时间：${formatTime(acc.createdAt)}`,
        `更新时间：${formatTime(acc.updatedAt)}`,
        `最近查询：${formatTime(acc.lastQueryAt)}`,
        `Cookie：${shortText(maskCookie(acc.cookie), 220)}`,
        q.error ? `查询错误：${q.error}` : ''
      ]);

      notifyRows.push(
        `${index + 1}. ${acc.email || acc.alias || id}\n` +
        `剩余：${acc.leftDays !== undefined ? acc.leftDays : '未知'} 天｜积分：${acc.points !== undefined ? acc.points : '未知'}`
      );
    });
  });

  chain.then(() => {
    saveStore(store);

    $notify(
      SCRIPT_NAME,
      `📦 当前共 ${ids.length} 个账号`,
      notifyRows.join('\n\n')
    );

    $done();
  }).catch(e => {
    const msg = e && e.message ? e.message : String(e);

    logBlock('❌ 查看脚本异常', [
      `错误：${msg}`
    ]);

    $notify(SCRIPT_NAME, '❌ 查看失败', msg);
    $done();
  });
}

main();