console.log("PolicyCheck start");

/**
 * Quantumult X 策略 / 流媒体检测
 * 适配你的策略组命名：
 * 家里内网、策略选择、GPT、Gemini、GitHub、YouTube、Netflix、Disney+、Telegram
 */

const POLICIES = {
  HOME: "内网穿透",
  PROXY: "基础支持",
  GPT: "GPT",
  GEMINI: "Gemini",
  GITHUB: "GitHub",
  YOUTUBE: "YouTube",
  NETFLIX: "Netflix",
  DISNEY: "Disney+",
  TELEGRAM: "Telegram"
};

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const TIMEOUT = 5000;

function flag(code) {
  if (!code) return "";
  code = code.toUpperCase();
  if (code === "UK") code = "GB";
  if (code.length !== 2) return code;
  return code.replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt()));
}

function stripHtml(text) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/br>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function timeoutPromise(name, ms = TIMEOUT) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(`<b>${name}: </b>检测超时 🚦`);
    }, ms);
  });
}

function fetchWithPolicy(url, policy, extra = {}) {
  const req = {
    url: url,
    method: extra.method || "GET",
    headers: Object.assign({
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9"
    }, extra.headers || {}),
    opts: {
      policy: policy
    }
  };

  if (extra.body) req.body = extra.body;
  if (extra.redirection === false) req.redirection = false;

  return $task.fetch(req);
}

async function runCheck(name, fn) {
  console.log("Start check: " + name);

  try {
    const result = await Promise.race([
      fn(),
      timeoutPromise(name, TIMEOUT)
    ]);

    console.log("Finish check: " + name);
    return result;
  } catch (e) {
    console.log("Error check " + name + ": " + e);
    return `<b>${name}: </b>检测异常 ❗️`;
  }
}

async function checkHome() {
  const res = await fetchWithPolicy("http://192.168.31.1", POLICIES.HOME);

  if (res.statusCode >= 200 && res.statusCode < 500) {
    return `<b>家里内网: </b>连通 ➟ 192.168.31.1 ✅`;
  }

  return `<b>家里内网: </b>异常 ➟ HTTP ${res.statusCode} 🚫`;
}

async function checkProxy() {
  const res = await fetchWithPolicy("http://www.gstatic.com/generate_204", POLICIES.PROXY);

  if (res.statusCode === 204 || res.statusCode === 200) {
    return `<b>策略选择: </b>基础连通 ✅`;
  }

  return `<b>策略选择: </b>异常 ➟ HTTP ${res.statusCode} 🚫`;
}

async function checkGitHub() {
  const res = await fetchWithPolicy(
    "https://raw.githubusercontent.com/reverie1988/Scripts/main/QX/PolicyCheck.js",
    POLICIES.GITHUB
  );

  if (res.statusCode === 200) {
    return `<b>GitHub: </b>可访问 ✅`;
  }

  return `<b>GitHub: </b>异常 ➟ HTTP ${res.statusCode} 🚫`;
}

async function checkTelegram() {
  const res = await fetchWithPolicy("https://telegram.org/", POLICIES.TELEGRAM);

  if (res.statusCode === 200) {
    return `<b>Telegram: </b>可访问 ✅`;
  }

  return `<b>Telegram: </b>异常 ➟ HTTP ${res.statusCode} 🚫`;
}

async function checkGPT() {
  let region = "";
  let traceOk = false;

  try {
    const trace = await fetchWithPolicy("https://chatgpt.com/cdn-cgi/trace", POLICIES.GPT);

    if (trace.statusCode === 200 && trace.body) {
      traceOk = true;
      const m = trace.body.match(/loc=([A-Z]{2})/);
      if (m && m[1]) region = m[1];
    }
  } catch (e) {
    console.log("ChatGPT trace error: " + e);
  }

  try {
    const res = await fetchWithPolicy("https://chatgpt.com/", POLICIES.GPT, {
      redirection: false
    });

    const body = res.body || "";

    // 明确的地区不支持页面
    if (
      body.includes("unsupported_country") ||
      body.includes("not available in your country")
    ) {
      return `<b>ChatGPT: </b>地区疑似不支持${region ? ` ➟ ${flag(region)} ${region}` : ""} 🚫`;
    }

    // 200-399 直接判定可访问
    if (res.statusCode >= 200 && res.statusCode < 400) {
      return `<b>ChatGPT: </b>可访问${region ? ` ➟ ${flag(region)} ${region}` : ""} 🎉`;
    }

    // 403 / 451 很多时候是 Cloudflare / WAF / 未登录页，不一定代表 GPT 不能用
    if ((res.statusCode === 403 || res.statusCode === 451) && traceOk) {
      return `<b>ChatGPT: </b>可访问${region ? ` ➟ ${flag(region)} ${region}` : ""} ⚠️`;
    }

    // trace 能通，也认为链路可用
    if (traceOk) {
      return `<b>ChatGPT: </b>可访问${region ? ` ➟ ${flag(region)} ${region}` : ""} 🎉`;
    }

    return `<b>ChatGPT: </b>异常 ➟ HTTP ${res.statusCode} ❗️`;

  } catch (e) {
    if (traceOk) {
      return `<b>ChatGPT: </b>可访问${region ? ` ➟ ${flag(region)} ${region}` : ""} ⚠️`;
    }

    return `<b>ChatGPT: </b>检测异常 ❗️`;
  }
}

async function checkGemini() {
  const res = await fetchWithPolicy("https://gemini.google.com/", POLICIES.GEMINI, {
    redirection: false
  });

  if (res.statusCode >= 200 && res.statusCode < 400) {
    return `<b>Gemini: </b>可访问 🎉`;
  }

  if (res.statusCode === 403 || res.statusCode === 451) {
    return `<b>Gemini: </b>未支持 ➟ HTTP ${res.statusCode} 🚫`;
  }

  return `<b>Gemini: </b>异常 ➟ HTTP ${res.statusCode} ❗️`;
}

async function checkYouTube() {
  const res = await fetchWithPolicy("https://www.youtube.com/premium", POLICIES.YOUTUBE);
  const body = res.body || "";

  if (res.statusCode !== 200) {
    return `<b>YouTube Premium: </b>异常 ➟ HTTP ${res.statusCode} ❗️`;
  }

  if (body.includes("Premium is not available in your country")) {
    return `<b>YouTube Premium: </b>未支持 🚫`;
  }

  let region = "";
  const m = body.match(/"GL":"([A-Z]{2})"/);
  if (m && m[1]) region = m[1];

  return `<b>YouTube Premium: </b>支持${region ? ` ➟ ${flag(region)} ${region}` : ""} 🎉`;
}

async function checkNetflix() {
  const res = await fetchWithPolicy("https://www.netflix.com/title/81280792", POLICIES.NETFLIX);

  if (res.statusCode === 403) {
    return `<b>Netflix: </b>未支持 🚫`;
  }

  if (res.statusCode === 404) {
    return `<b>Netflix: </b>仅支持自制剧 ⚠️`;
  }

  if (res.statusCode === 200) {
    return `<b>Netflix: </b>完整支持 🎉`;
  }

  return `<b>Netflix: </b>异常 ➟ HTTP ${res.statusCode} ❗️`;
}

async function checkDisney() {
  const res = await fetchWithPolicy("https://www.disneyplus.com/", POLICIES.DISNEY);
  const body = res.body || "";

  if (res.statusCode !== 200) {
    return `<b>Disney+: </b>异常 ➟ HTTP ${res.statusCode} ❗️`;
  }

  if (body.includes("not available in your region")) {
    return `<b>Disney+: </b>未支持 🚫`;
  }

  let region = "";
  const m = body.match(/Region:\s*([A-Za-z]{2})/);
  if (m && m[1]) region = m[1].toUpperCase();

  return `<b>Disney+: </b>可访问${region ? ` ➟ ${flag(region)} ${region}` : ""} 🎉`;
}

async function main() {
  const results = [];

  results.push(await runCheck("家里内网", checkHome));
  results.push(await runCheck("策略选择", checkProxy));
  results.push(await runCheck("GitHub", checkGitHub));
  results.push(await runCheck("Telegram", checkTelegram));
  results.push(await runCheck("ChatGPT", checkGPT));
  results.push(await runCheck("Gemini", checkGemini));
  results.push(await runCheck("YouTube", checkYouTube));
  results.push(await runCheck("Netflix", checkNetflix));
  results.push(await runCheck("Disney+", checkDisney));

  const html = `
  <p style="text-align:center;font-family:-apple-system;font-size:large;">
    <b>策略 / 流媒体检测</b><br>
    --------------------------------------<br><br>
    ${results.join("<br><br>")}
    <br><br>--------------------------------------<br>
    <font color="#CD5C5C">检测完成</font>
  </p>`;

  const plain = results.map(stripHtml).join("\n\n");

  console.log("PolicyCheck done");

  $notify("策略/流媒体检测", "检测完成", plain);

  $done({
    title: "策略/流媒体检测",
    content: plain,
    htmlMessage: html
  });
}

main().catch(e => {
  console.log("Main error: " + e);

  $done({
    title: "策略/流媒体检测",
    content: "检测异常：" + e,
    htmlMessage: `<p style="text-align:center;">检测异常：${e}</p>`
  });
});
