// 2026/05/06
/*
项目: 大潮
名称: 大潮提现/红包 QX版
用途:
1. 手机号/密码/member id 硬编码在脚本里。
2. member 从 QX 本地 dctx_member_store_v1 读取。
3. 每个账号通过 member id 精准匹配自己的本地 member。
4. 不再依赖 Utils.js，改为自动加载 crypto-js + jsencrypt。

账号格式：
member里的id#手机号#密码

示例：
1293d527550bb307ea8c6edc5f90ef76#13800138000#你的密码

QX task 示例：
30 30,35,40 9 * * * DCTX_Run_QX.js, tag=大潮提现, enabled=true
*/

const $ = new Env('💲 大潮提现');

// ========== 多账号硬编码配置 ==========
// 格式：member里的id#手机号#密码
// 一行一个账号。
// 注意：密码里如果包含 #，也可以正常识别，从第 3 段开始都会当作密码。
const ACCOUNT_TEXT = `
1293d527550bb307ea8c6edc5f90ef76#13800138000#你的密码
id2#手机号2#密码2
`;

// ========== 本地 member 配置 ==========
const MEMBER_STORE_KEY = 'dctx_member_store_v1';

// 没有本地 member 时，是否仍然执行登录和查询奖品。
// true：仍执行，但红包只能输出手动领取链接。
// false：该账号直接跳过。
const RUN_WITHOUT_LOCAL_MEMBER = true;

// 是否在日志中显示完整 member。member 是敏感信息，默认关闭。
const SHOW_FULL_MEMBER_IN_LOG = false;

// 依赖缓存 key
const CRYPTOJS_CACHE_KEY = 'DCTX_CryptoJS_Code_v1';
const JSENCRYPT_CACHE_KEY = 'DCTX_JSEncrypt_Code_v1';

let CryptoJS = undefined;
let JSEncryptClass = undefined;

let signature_key = '';
let lotteryNotice = '';
let sessionId = '';
let tenantId = '94';
let accountId = '';
let clientId = '10048';
let signatureSalt = 'FR*r!isE5W';

let bindMemberId = '';
let phone_number = '';
let password = '';
let memberhongbao = '';

let ua = '';
let commonUa = '';
let member = '';
let id = '';
let signature = '';
let timestamp = '';
let detail = '';
let countzh = 1;

!(async () => {
  await main();
})().catch((e) => {
  $.log(`❌ 脚本异常：${e && e.message ? e.message : String(e)}`);
}).finally(() => {
  $.done({});
});

function getAccounts() {
  return String(ACCOUNT_TEXT || '')
    .split(/\n+/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('#'))
    .map(s => {
      const parts = s.split('#');
      const memberId = String(parts[0] || '').trim();
      const phone = String(parts[1] || '').trim();

      // 防止密码里包含 #，从第 3 段开始重新拼回去
      const password = parts.slice(2).join('#').trim();

      return {
        memberId,
        phone,
        password
      };
    })
    .filter(x => x.memberId && x.phone && x.password);
}

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}

function maskPhone(phone) {
  const s = String(phone || '');
  if (/^\d{11}$/.test(s)) {
    return s.slice(0, 3) + '****' + s.slice(7);
  }
  if (s.length > 6) {
    return s.slice(0, 3) + '****' + s.slice(-3);
  }
  return s || '未知';
}

function shortText(text, maxLen) {
  if (!text) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}

function maskMemberText(text) {
  if (!text) return '';
  if (SHOW_FULL_MEMBER_IN_LOG) return String(text);

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

function loadMemberStore() {
  const raw = $.getdata(MEMBER_STORE_KEY) || '';
  const obj = safeJsonParse(raw, { accounts: {} });

  if (!obj || typeof obj !== 'object' || !obj.accounts) {
    return { accounts: {} };
  }

  return obj;
}

function getLocalMemberForAccount(memberId, phone) {
  const store = loadMemberStore();
  const accounts = store.accounts || {};

  const targetId = String(memberId || '').trim();
  const targetPhone = String(phone || '').trim();

  // 1. 优先用 member id 直接匹配本地 key
  if (targetId && accounts[targetId] && accounts[targetId].raw) {
    return accounts[targetId].raw;
  }

  // 2. 再用手机号直接匹配本地 key
  if (targetPhone && accounts[targetPhone] && accounts[targetPhone].raw) {
    return accounts[targetPhone].raw;
  }

  // 3. 遍历本地记录，匹配 key / rec.id / rec.phone / rec.mobile / raw 里的 id
  for (const key of Object.keys(accounts)) {
    const rec = accounts[key];
    if (!rec) continue;

    const parsed = safeJsonParse(rec.raw, {});

    const values = [
      key,
      rec.key,
      rec.id,
      rec.phone,
      rec.mobile,
      parsed.id,
      parsed.phone,
      parsed.mobile
    ].map(v => String(v || '').trim());

    if (values.includes(targetId) || values.includes(targetPhone)) {
      return rec.raw || '';
    }
  }

  return '';
}

async function sendMsg(message) {
  const formattedMessage = String(message || '')
    .trim()
    .replace(/👤 - /g, '\n------------------------------\n👤 - ')
    .replace(/^\n*------------------------------\n/, '');

  $.msg($.name, '', formattedMessage || '无通知内容');
}

async function main() {
  const accounts = getAccounts();

  if (!accounts.length) {
    const msg = '未配置账号。请在脚本顶部 ACCOUNT_TEXT 中填写：member的id#手机号#密码';
    console.log(msg);
    $.msg($.name, '未配置账号', msg);
    return;
  }

  const libsOk = await loadCryptoAndJSEncrypt();

  if (!libsOk) {
    $.msg($.name, '依赖加载失败', 'crypto-js 或 jsencrypt 加载失败，请检查网络');
    return;
  }

  for (const item of accounts) {
    try {
      resetAccountState();

      const randomUA = generateRandomUA();
      ua = randomUA.ua;
      commonUa = randomUA.commonUa;

      bindMemberId = item.memberId;
      phone_number = item.phone;
      password = item.password;

      memberhongbao = getLocalMemberForAccount(bindMemberId, phone_number);

      console.log(`\n\n----------- 账号【${countzh}/${accounts.length}】执行 -----------`);
      countzh++;

      const hiddenPhone = maskPhone(phone_number);
      console.log(`📱：${hiddenPhone}`);
      console.log(`🆔：${bindMemberId}`);

      if (memberhongbao) {
        console.log(`✅ 已读取本地 member：${shortText(maskMemberText(memberhongbao), 260)}`);
      } else {
        console.log('⚠️ 未读取到本地 member');

        if (!RUN_WITHOUT_LOCAL_MEMBER) {
          lotteryNotice += `👤 - ${hiddenPhone}\n⚠️ 未找到本地 member，已跳过该账号\n`;
          continue;
        }
      }

      // 初始化会话
      const initSession = await commonPost('/api/account/init');

      if (!initSession || !initSession.data || !initSession.data.session) {
        lotteryNotice += `👤 - ${hiddenPhone}\n❌ 初始化会话失败\n`;
        continue;
      }

      sessionId = initSession.data.session.id;

      const init = await initGet(`/web/init?client_id=${clientId}`);

      if (!init || !init.data || !init.data.client) {
        lotteryNotice += `👤 - ${hiddenPhone}\n❌ 初始化 client 失败\n`;
        continue;
      }

      signature_key = init.data.client.signature_key;

      // 认证登录
      const credential_auth = await passportPost('/web/oauth/credential_auth');

      if (!credential_auth || !credential_auth.data || !credential_auth.data.authorization_code) {
        lotteryNotice += `👤 - ${hiddenPhone}\n❌ 登录失败，请检查手机号/密码\n`;
        continue;
      }

      const code = credential_auth.data.authorization_code.code;

      const login = await commonPost(
        '/api/zbtxz/login',
        `check_token=&code=${code}&token=&type=-1&union_id=`
      );

      if (!login || !login.data || !login.data.session) {
        lotteryNotice += `👤 - ${hiddenPhone}\n❌ 登录换取 session 失败\n`;
        continue;
      }

      accountId = login.data.session.account_id;
      sessionId = login.data.session.id;

      // 获取账户详情
      detail = await commonGet('/api/user_mumber/account_detail');

      if (!detail || !detail.data || !detail.data.rst) {
        lotteryNotice += `👤 - ${hiddenPhone}\n❌ 获取账户详情失败\n`;
        continue;
      }

      timestamp = Math.round(Date.now() / 1000).toString();

      // 生成活动 member，用于查询奖品列表
      signature = await activityPost('/memberhy/tm/signature', {
        accountId: accountId,
        signature: CryptoJS.SHA256(
          ` &id&mobile&nick_name&&${timestamp}&&KO>N<O5&3^L1%23YH0H1#G91 * 2H`
        ).toString(),
        mobile: '1',
        sessionId: sessionId,
        login: '1',
        user: {
          realName: '',
          image_url: detail.data.rst.image_url,
          nick_name: detail.data.rst.nick_name,
          is_face_verify: 0,
          idcard: '',
          id: accountId
        },
        timestamp: timestamp,
        sign: 'xsb_hn'
      });

      if (!signature || !signature.id) {
        lotteryNotice += `👤 - ${hiddenPhone}\n❌ 生成活动 member 失败\n`;
        continue;
      }

      member = JSON.stringify({
        id: signature.id,
        black: 0,
        btoken: signature.btoken,
        expire: signature.expire,
        token: signature.token,
        source: 'xsb_hn',
        mobile: signature.mobile,
        mark: signature.mark,
        mtoken: signature.mtoken,
        stoken: signature.stoken,
        nick_name: encodeURIComponent(signature.nick_name || ''),
        avatar: signature.avatar
      });

      // 获取奖品信息
      const prizeInfo = await activityGet(
        '/lotteryhy/api/client/cj/member/prize/info?prize_type=3&page=1&count=20'
      );

      const prizes = prizeInfo && Array.isArray(prizeInfo.data) ? prizeInfo.data : [];

      if (!prizes.length) {
        lotteryNotice += `👤 - ${hiddenPhone}\nℹ️ 暂无可处理红包\n`;
        continue;
      }

      let accountNotice = '';

      for (const prize of prizes) {
        const prizeInfoObj = safeJsonParse(prize.prize_info, {});
        const code = prizeInfoObj.code;

        if (!code) continue;

        if (prize.prize_type == 3 && prize.status != 2 && prize.status != 6) {
          if (memberhongbao) {
            const hongbao = await hongbaoPost('/lotteryhy/api/client/cj/send/pak', {
              code: code
            });

            if (hongbao && hongbao.success) {
              console.log(`✅ ${prize.prize_content} 领取成功`);
              accountNotice += `✅ ${prize.prize_content} 领取成功\n`;
            } else {
              console.log(`❌ ${prize.prize_content} 需手动领取`);
              accountNotice += `❌ ${prize.prize_content} 需手动领取\n🌈 链接：\nhttps://m.aihoge.com/lottery/rotor/drawRedPacket?CHECK_CODE=${code}\n`;
            }
          } else {
            console.log(`❌ ${prize.prize_content} 需手动领取，本地无 member`);
            accountNotice += `❌ ${prize.prize_content} 需手动领取，本地无 member\n🌈 链接：\nhttps://m.aihoge.com/lottery/rotor/drawRedPacket?CHECK_CODE=${code}\n`;
          }
        }
      }

      if (accountNotice) {
        lotteryNotice += `👤 - ${hiddenPhone}\n${accountNotice}`;
      } else {
        lotteryNotice += `👤 - ${hiddenPhone}\nℹ️ 没有待领取红包\n`;
      }
    } catch (e) {
      const err = e && e.message ? e.message : String(e);
      console.log(`⚠️ 账号处理异常: ${err}`);
      lotteryNotice += `👤 - ${maskPhone(phone_number)}\n⚠️ 账号处理异常：${err}\n`;
    }
  }

  console.log('\n----------- 执 行 完 毕 -----------');

  if (lotteryNotice) {
    await sendMsg(lotteryNotice);
  }
}

function resetAccountState() {
  signature_key = '';
  sessionId = '';
  accountId = '';

  bindMemberId = '';
  phone_number = '';
  password = '';
  memberhongbao = '';

  ua = '';
  commonUa = '';
  member = '';
  id = '';
  signature = '';
  timestamp = '';
  detail = '';
}

async function initGet(url) {
  return new Promise(resolve => {
    const options = {
      url: `https://passport.tmuyun.com${url}`,
      headers: {
        Connection: 'Keep-Alive',
        'Cache-Control': 'no-cache',
        'X-REQUEST-ID': generateUUID(),
        'Accept-Encoding': 'gzip',
        'user-agent': ua
      }
    };

    $.get(options, (err, resp, data) => {
      resolveResponse(err, resp, data, resolve);
    });
  });
}

async function hongbaoPost(url, body) {
  return new Promise(resolve => {
    const options = {
      url: `https://m.aihoge.com/api${url}`,
      headers: {
        Connection: 'keep-alive',
        'X-DEVICE-SIGN': 'wechat',
        'X-CLIENT-VERSION': '1314',
        'Content-Type': 'application/json;charset=UTF-8',
        accept: 'application/json, text/plain, */*',
        'user-agent': 'Mozilla/5.0 (Linux; Android 11; 21091116AC Build/RP1A.200720.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/94.0.4606.85 Mobile Safari/537.36;xsb_hn;xsb_hn;14.1.6;native_app;6.11.0',
        'HTTP-X-H5-VERSION': '1',
        member: memberhongbao,
        Limit: 'default',
        'X-DEVICE-ID': '000',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'accept-encoding': 'gzip, deflate',
        'accept-language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      body: JSON.stringify(body)
    };

    $.post(options, (err, resp, data) => {
      resolveResponse(err, resp, data, resolve);
    });
  });
}

async function passportPost(url) {
  const params = getBody();

  return new Promise(resolve => {
    const options = {
      url: `https://passport.tmuyun.com${url}`,
      headers: {
        Connection: 'Keep-Alive',
        'X-REQUEST-ID': params.uuid,
        'X-SIGNATURE': params.signature,
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Accept-Encoding': 'gzip',
        'user-agent': ua
      },
      body: params.body
    };

    $.post(options, (err, resp, data) => {
      resolveResponse(err, resp, data, resolve);
    });
  });
}

async function commonGet(url) {
  const params = getParams(url);

  return new Promise(resolve => {
    const options = {
      url: `https://vapp.tmuyun.com${url}`,
      headers: {
        Connection: 'Keep-Alive',
        'X-TIMESTAMP': params.time,
        'X-SESSION-ID': sessionId,
        'X-REQUEST-ID': params.uuid,
        'X-SIGNATURE': params.signature,
        'X-TENANT-ID': tenantId,
        'X-ACCOUNT-ID': accountId,
        'Cache-Control': 'no-cache',
        'Accept-Encoding': 'gzip',
        'user-agent': commonUa
      }
    };

    $.get(options, (err, resp, data) => {
      resolveResponse(err, resp, data, resolve);
    });
  });
}

async function commonPost(url, body) {
  const params = getParams(url);

  return new Promise(resolve => {
    const options = {
      url: `https://vapp.tmuyun.com${url}`,
      headers: {
        Connection: 'Keep-Alive',
        'X-TIMESTAMP': params.time,
        'X-SESSION-ID': sessionId,
        'X-REQUEST-ID': params.uuid,
        'X-SIGNATURE': params.signature,
        'X-TENANT-ID': tenantId,
        'X-ACCOUNT-ID': accountId,
        'Cache-Control': 'no-cache',
        'Accept-Encoding': 'gzip',
        'user-agent': commonUa
      },
      body: body
    };

    $.post(options, (err, resp, data) => {
      resolveResponse(err, resp, data, resolve);
    });
  });
}

async function activityGet(url) {
  return new Promise(resolve => {
    const options = {
      url: `https://m.aihoge.com/api${url}`,
      headers: activityHeaders(false)
    };

    $.get(options, (err, resp, data) => {
      resolveResponse(err, resp, data, resolve);
    });
  });
}

async function activityPost(url, body) {
  return new Promise(resolve => {
    const options = {
      url: `https://m.aihoge.com/api${url}`,
      headers: activityHeaders(true),
      body: JSON.stringify(body)
    };

    $.post(options, (err, resp, data) => {
      resolveResponse(err, resp, data, resolve);
    });
  });
}

function activityHeaders(isPost) {
  const headers = {
    Connection: 'keep-alive',
    'X-DEVICE-SIGN': 'xsb_hn',
    'X-CLIENT-VERSION': '1314',
    accept: 'application/json, text/plain, */*',
    'user-agent': 'Mozilla/5.0 (Linux; Android 11; 21091116AC Build/RP1A.200720.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/94.0.4606.85 Mobile Safari/537.36;xsb_hn;xsb_hn;14.1.6;native_app;6.11.0',
    'HTTP-X-H5-VERSION': '1',
    member: member,
    Limit: id,
    sessionId: sessionId,
    'X-DEVICE-ID': '000',
    accountId: accountId,
    'x-requested-with': 'com.hoge.android.app.dachao',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
    Referer: `https://m.aihoge.com/h5?mark=news-read@designh5&tid=${id}&path=index&isNeedLogin=true`,
    'accept-encoding': 'gzip, deflate',
    'accept-language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7'
  };

  if (isPost) {
    headers['Content-Type'] = 'application/json;charset=UTF-8';
  }

  return headers;
}

function resolveResponse(err, resp, data, resolve) {
  if (err) {
    console.log(`${JSON.stringify(err)}`);
    console.log(`${$.name} API请求失败，请检查网络重试`);
    resolve(null);
    return;
  }

  const text = typeof data === 'string' ? data : String(data || '');
  const obj = safeJsonParse(text, null);

  if (obj !== null) {
    resolve(obj);
  } else {
    console.log(`响应不是 JSON：${text.slice(0, 200)}`);
    resolve(text);
  }
}

function getBody() {
  const key = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQD6XO7e9YeAOs+cFqwa7ETJ+WXizPqQeXv68i5vqw9pFREsrqiBTRcg7wB0RIp3rJkDpaeVJLsZqYm5TW7FWx/iOiXFc+zCPvaKZric2dXCw27EvlH5rq+zwIPDAJHGAfnn1nmQH7wR3PCatEIb8pz5GFlTHMlluw4ZYmnOwg+thwIDAQAB';

  if (!CryptoJS || !JSEncryptClass) {
    throw new Error('依赖未加载：CryptoJS 或 JSEncryptClass 不存在');
  }

  const encryptor = new JSEncryptClass();
  encryptor.setPublicKey(key);

  const encryptedPassword = encryptor.encrypt(password);

  if (!encryptedPassword) {
    throw new Error('密码 RSA 加密失败');
  }

  const uuid = generateUUID();

  const rawBody = `client_id=${clientId}&password=${encryptedPassword}&phone_number=${phone_number}`;
  const str = `post%%/web/oauth/credential_auth?${rawBody}%%${uuid}%%`;

  const body = `client_id=${clientId}&password=${encodeURIComponent(encryptedPassword)}&phone_number=${phone_number}`;

  const hash = CryptoJS.HmacSHA256(str, signature_key);
  const sig = CryptoJS.enc.Hex.stringify(hash);

  return {
    uuid: uuid,
    signature: sig,
    body: body
  };
}

function getParams(url) {
  const uuid = generateUUID();
  const time = Date.now();

  let path = url;
  if (path.indexOf('?') > 0) {
    path = path.substring(0, path.indexOf('?'));
  }

  if (!CryptoJS) {
    throw new Error('依赖未加载：CryptoJS 不存在');
  }

  const sig = CryptoJS.SHA256(
    `${path}&&${sessionId}&&${uuid}&&${time}&&${signatureSalt}&&${tenantId}`
  ).toString();

  return {
    uuid: uuid,
    time: time,
    signature: sig
  };
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomUA() {
  const version = '14.1.6';
  const uuid = generateUUID();

  const deviceIds = [
    'M1903F2A',
    'M2001J2E',
    'M2001J2C',
    'M2001J1E',
    'M2001J1C',
    'M2002J9E',
    'M2011K2C',
    'M2102K1C',
    'M2101K9C',
    '2107119DC',
    '2201123C',
    '2112123AC',
    '2201122C',
    '2211133C',
    '2210132C',
    '2304FPN6DC',
    '23127PN0CC',
    '24031PN0DC',
    '23090RA98C',
    '2312DRA50C',
    '2312CRAD3C',
    '2312DRAABC',
    '22101316UCP',
    '22101316C'
  ];

  const deviceId = getRandomElement(deviceIds);
  const device = 'Xiaomi ' + deviceId;
  const os = 'Android';
  const osVersion = '11';
  const appVersion = '6.11.0';

  const ua = `${os.toUpperCase()};${osVersion};${clientId};${version};1.0;null;${deviceId}`;
  const commonUa = `${version};${uuid};${device};${os};${osVersion};${appVersion}`;

  return {
    ua: ua,
    commonUa: commonUa,
    uuid: uuid
  };
}

async function loadCryptoAndJSEncrypt() {
  const cryptoOk = await loadOneLib({
    name: 'CryptoJS',
    cacheKey: CRYPTOJS_CACHE_KEY,
    urls: [
      'https://cdn.jsdelivr.net/npm/crypto-js@4.2.0/crypto-js.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js'
    ],
    checker: () => {
      const g = getGlobalObject();
      CryptoJS = g.CryptoJS || CryptoJS;
      return !!(
        CryptoJS &&
        CryptoJS.SHA256 &&
        CryptoJS.HmacSHA256 &&
        CryptoJS.enc &&
        CryptoJS.enc.Hex
      );
    }
  });

  const jsEncryptOk = await loadOneLib({
    name: 'JSEncrypt',
    cacheKey: JSENCRYPT_CACHE_KEY,
    urls: [
      'https://cdn.jsdelivr.net/npm/jsencrypt@3.3.2/bin/jsencrypt.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jsencrypt/3.3.2/jsencrypt.min.js'
    ],
    checker: () => {
      const g = getGlobalObject();
      JSEncryptClass =
        g.JSEncrypt ||
        (g.window && g.window.JSEncrypt) ||
        (g.self && g.self.JSEncrypt) ||
        JSEncryptClass;

      return typeof JSEncryptClass === 'function';
    }
  });

  console.log(`依赖加载结果：CryptoJS=${cryptoOk ? '✅' : '❌'}，JSEncrypt=${jsEncryptOk ? '✅' : '❌'}`);

  return cryptoOk && jsEncryptOk;
}

async function loadOneLib({ name, cacheKey, urls, checker }) {
  const cache = $.getdata(cacheKey) || '';

  if (cache && cache.length > 100) {
    try {
      prepareGlobalForLib();
      evalInGlobal(cache);

      if (checker()) {
        console.log(`✅ ${name} 使用本地缓存`);
        return true;
      }

      console.log(`⚠️ ${name} 缓存无效，清空后重新下载`);
      $.setdata('', cacheKey);
    } catch (e) {
      console.log(`⚠️ ${name} 缓存执行失败，清空后重新下载：${e.message || e}`);
      $.setdata('', cacheKey);
    }
  }

  for (const url of urls) {
    try {
      console.log(`🚀 下载依赖：${name}`);
      const code = await $.getScript(url);

      if (!code || code.length < 100) {
        console.log(`⚠️ ${name} 下载内容异常，尝试下一个地址`);
        continue;
      }

      prepareGlobalForLib();
      evalInGlobal(code);

      if (checker()) {
        $.setdata(code, cacheKey);
        console.log(`✅ ${name} 加载成功`);
        return true;
      }

      console.log(`⚠️ ${name} 加载后检测失败，尝试下一个地址`);
    } catch (e) {
      console.log(`⚠️ ${name} 下载/执行异常：${e.message || e}`);
    }
  }

  return false;
}

function getGlobalObject() {
  if (typeof globalThis !== 'undefined') return globalThis;
  return Function('return this')();
}

function prepareGlobalForLib() {
  const g = getGlobalObject();

  if (!g.window) {
    g.window = g;
  }

  if (!g.self) {
    g.self = g;
  }

  if (!g.navigator) {
    g.navigator = {};
  }
}

function evalInGlobal(code) {
  const g = getGlobalObject();
  Function('window', 'self', 'globalThis', String(code)).call(g, g.window || g, g.self || g, g);
}

function Env(name) {
  return new class {
    constructor(name) {
      this.name = name;
      this.startTime = Date.now();
      this.isMute = false;
      this.logs = [];
      console.log(`\n          ${this.name}`);
    }

    getEnv() {
      if (typeof $task !== 'undefined') return 'Quantumult X';
      if (typeof $httpClient !== 'undefined') return 'Surge/Loon/Stash';
      return 'Unknown';
    }

    getdata(key) {
      if (typeof $prefs !== 'undefined') {
        return $prefs.valueForKey(key);
      }

      if (typeof $persistentStore !== 'undefined') {
        return $persistentStore.read(key);
      }

      return '';
    }

    setdata(val, key) {
      if (typeof $prefs !== 'undefined') {
        return $prefs.setValueForKey(val, key);
      }

      if (typeof $persistentStore !== 'undefined') {
        return $persistentStore.write(val, key);
      }

      return false;
    }

    getScript(url) {
      return new Promise(resolve => {
        this.get({ url: url }, (err, resp, body) => {
          if (err) {
            console.log(`依赖下载失败：${url}，错误：${err}`);
            resolve('');
          } else {
            resolve(body || '');
          }
        });
      });
    }

    get(options, callback) {
      if (typeof $task !== 'undefined') {
        const opt = typeof options === 'string' ? { url: options } : Object.assign({}, options);
        opt.method = 'GET';

        $task.fetch(opt).then(resp => {
          callback(
            null,
            {
              status: resp.statusCode,
              statusCode: resp.statusCode,
              headers: resp.headers,
              body: resp.body
            },
            resp.body
          );
        }, err => {
          callback(err && err.error ? err.error : err, null, null);
        });
      } else if (typeof $httpClient !== 'undefined') {
        $httpClient.get(options, callback);
      } else {
        callback('未知运行环境，无法发送 GET 请求', null, null);
      }
    }

    post(options, callback) {
      if (typeof $task !== 'undefined') {
        const opt = typeof options === 'string' ? { url: options } : Object.assign({}, options);
        opt.method = 'POST';

        $task.fetch(opt).then(resp => {
          callback(
            null,
            {
              status: resp.statusCode,
              statusCode: resp.statusCode,
              headers: resp.headers,
              body: resp.body
            },
            resp.body
          );
        }, err => {
          callback(err && err.error ? err.error : err, null, null);
        });
      } else if (typeof $httpClient !== 'undefined') {
        $httpClient.post(options, callback);
      } else {
        callback('未知运行环境，无法发送 POST 请求', null, null);
      }
    }

    msg(title = this.name, subtitle = '', body = '', opts = {}) {
      if (this.isMute) return;

      if (typeof $notify !== 'undefined') {
        $notify(title, subtitle, body, opts);
      } else if (typeof $notification !== 'undefined') {
        $notification.post(title, subtitle, body, opts);
      }

      console.log(
        `\n==============📣系统通知📣==============\n${title}\n${subtitle}\n${body}`
      );
    }

    log(...args) {
      console.log(args.map(x => x == null ? '' : String(x)).join('\n'));
    }

    done(value = {}) {
      const cost = ((Date.now() - this.startTime) / 1000).toFixed(2);
      console.log(`\n${this.name} 运行结束，用时 ${cost}s`);

      if (typeof $done !== 'undefined') {
        $done(value);
      }
    }
  }(name);
}