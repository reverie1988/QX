console.log("PolicyCheck start");

/**
 * Quantumult X 策略 / 流媒体检测
 * 适配策略组：
 * 家里内网、基础支持、人工智能、Gemini、GitHub、YouTube、Netflix、Disney+、Telegram
 */

const POLICIES = {
  // 如果你的策略组实际叫“内网穿透”，把这里改回“内网穿透”
  HOME: "家里内网",

  PROXY: "基础支持",
  AI: "人工智能",
  GEMINI: "Gemini",
  GITHUB: "GitHub",
  YOUTUBE: "YouTube",
  NETFLIX: "Netflix",
  DISNEY: "Disney+",
  TELEGRAM: "Telegram"
};

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const TIMEOUT = 8000;

function flag(code) {
  if (!code) return "";
  code = String(code).toUpperCase();
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

function status(res) {
  return Number(res && res.statusCode ? res.statusCode : 0);
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

  let timer;

  try {
    const result = await Promise.race([
      fn(),
      new Promise(resolve => {
        timer = setTimeout(() => {
          resolve(`<b>${name}: </b>检测超时 🚦`);
        }, TIMEOUT);
      })
    ]);

    if (timer) clearTimeout(timer);

    console.log("Finish check: " + name);
    return result;
  } catch (e) {
    if (timer) clearTimeout(timer);

    console.log("Error check " + name + ": " + e);
    return `<b>${name}: </b>检测异常 ❗️`;
  }
}

async function checkHome() {
  const res = await fetchWithPolicy("http://192.168.31.1", POLICIES.HOME);
  const code = status(res);

  if (code >= 200 && code < 500) {
    return `<b>家里内网: </b>连通 ➟ 192.168.31.1 ✅`;
  }

  return `<b>家里内网: </b>异常 ➟ HTTP ${code} 🚫`;
}

async function checkProxy() {
  const res = await fetchWithPolicy("http://www.gstatic.com/generate_204", POLICIES.PROXY);
  const code = status(res);

  if (code === 204 || code === 200) {
    return `<b>基础支持: </b>基础连通 ✅`;
  }

  return `<b>基础支持: </b>异常 ➟ HTTP ${code} 🚫`;
}

async function checkGitHub() {
  const res = await fetchWithPolicy(
    "https://raw.githubusercontent.com/reverie1988/Scripts/main/QX/PolicyCheck.js",
    POLICIES.GITHUB
  );

  const code = status(res);

  if (code === 200) {
    return `<b>GitHub: </b>可访问 ✅`;
  }

  return `<b>GitHub: </b>异常 ➟ HTTP ${code} 🚫`;
}

async function checkTelegram() {
  const res = await fetchWithPolicy("https://telegram.org/", POLICIES.TELEGRAM);
  const code = status(res);

  if (code >= 200 && code < 400) {
    return `<b>Telegram: </b>可访问 ✅`;
  }

  return `<b>Telegram: </b>异常 ➟ HTTP ${code} 🚫`;
}

async function checkGPT() {
  let region = "";
  let traceOk = false;

  try {
    const trace = await fetchWithPolicy("https://chatgpt.com/cdn-cgi/trace", POLICIES.AI);
    const traceCode = status(trace);

    if (traceCode === 200 && trace.body) {
      traceOk = true;

      const m = trace.body.match(/loc=([A-Z]{2})/);
      if (m && m[1]) region = m[1];
    }
  } catch (e) {
    console.log("ChatGPT trace error: " + e);
  }

  try {
    const res = await fetchWithPolicy("https://chatgpt.com/", POLICIES.AI, {
      redirection: false
    });

    const code = status(res);
    const body = res.body || "";

    if (
      body.includes("unsupported_country") ||
      body.includes("not available in your country")
    ) {
      return `<b>ChatGPT: </b>地区疑似不支持${region ? ` ➟ ${flag(region)} ${region}` : ""} 🚫`;
    }

    if (code >= 200 && code < 400) {
      return `<b>ChatGPT: </b>可访问${region ? ` ➟ ${flag(region)} ${region}` : ""} 🎉`;
    }

    if ((code === 403 || code === 451) && traceOk) {
      return `<b>ChatGPT: </b>链路可用${region ? ` ➟ ${flag(region)} ${region}` : ""} ⚠️`;
    }

    if (traceOk) {
      return `<b>ChatGPT: </b>链路可用${region ? ` ➟ ${flag(region)} ${region}` : ""} 🎉`;
    }

    return `<b>ChatGPT: </b>异常 ➟ HTTP ${code} ❗️`;
  } catch (e) {
    if (traceOk) {
      return `<b>ChatGPT: </b>链路可用${region ? ` ➟ ${flag(region)} ${region}` : ""} ⚠️`;
    }

    return `<b>ChatGPT: </b>检测异常 ❗️`;
  }
}

async function checkGemini() {
  const res = await fetchWithPolicy("https://gemini.google.com/", POLICIES.GEMINI, {
    redirection: false
  });

  const code = status(res);

  if (code >= 200 && code < 400) {
    return `<b>Gemini: </b>可访问 🎉`;
  }

  if (code === 403 || code === 451) {
    return `<b>Gemini: </b>未支持 ➟ HTTP ${code} 🚫`;
  }

  return `<b>Gemini: </b>异常 ➟ HTTP ${code} ❗️`;
}

async function checkYouTube() {
  let basicOk = false;

  try {
    const ping = await fetchWithPolicy("https://www.youtube.com/generate_204", POLICIES.YOUTUBE, {
      redirection: false
    });

    const pingCode = status(ping);

    if (pingCode === 204 || pingCode === 200 || pingCode === 301 || pingCode === 302) {
      basicOk = true;
    }
  } catch (e) {
    console.log("YouTube generate_204 error: " + e);
  }

  try {
    const res = await fetchWithPolicy("https://www.youtube.com/premium", POLICIES.YOUTUBE, {
      redirection: false
    });

    const code = status(res);
    const body = res.body || "";

    let region = "";
    let m =
      body.match(/"GL":"([A-Z]{2})"/) ||
      body.match(/"countryCode":"([A-Z]{2})"/) ||
      body.match(/"regionCode":"([A-Z]{2})"/);

    if (m && m[1]) region = m[1];

    if (body.includes("Premium is not available in your country")) {
      return `<b>YouTube Premium: </b>未支持${region ? ` ➟ ${flag(region)} ${region}` : ""} 🚫`;
    }

    if (code === 200) {
      return `<b>YouTube Premium: </b>支持${region ? ` ➟ ${flag(region)} ${region}` : ""} 🎉`;
    }

    if (code >= 300 && code < 400) {
      return `<b>YouTube: </b>网页可访问，Premium 跳转检测${region ? ` ➟ ${flag(region)} ${region}` : ""} ⚠️`;
    }

    if (basicOk) {
      return `<b>YouTube: </b>基础可访问，Premium 检测异常 ➟ HTTP ${code} ⚠️`;
    }

    return `<b>YouTube: </b>异常 ➟ HTTP ${code} ❗️`;
  } catch (e) {
    if (basicOk) {
      return `<b>YouTube: </b>基础可访问，Premium 检测失败 ⚠️`;
    }

    return `<b>YouTube: </b>检测异常 ❗️`;
  }
}

async function checkNetflix() {
  const res = await fetchWithPolicy("https://www.netflix.com/title/81280792", POLICIES.NETFLIX, {
    redirection: false
  });

  const code = status(res);

  if (code === 403) {
    return `<b>Netflix: </b>未支持 🚫`;
  }

  if (code === 404) {
    return `<b>Netflix: </b>仅支持自制剧 ⚠️`;
  }

  if (code >= 200 && code < 400) {
    return `<b>Netflix: </b>完整支持 🎉`;
  }

  return `<b>Netflix: </b>异常 ➟ HTTP ${code} ❗️`;
}

async function checkDisney() {
  const res = await fetchWithPolicy("https://www.disneyplus.com/", POLICIES.DISNEY, {
    redirection: false
  });

  const code = status(res);
  const body = res.body || "";

  if (body.includes("not available in your region")) {
    return `<b>Disney+: </b>未支持 🚫`;
  }

  let region = "";
  const m = body.match(/Region:\s*([A-Za-z]{2})/);
  if (m && m[1]) region = m[1].toUpperCase();

  if (code >= 200 && code < 400) {
    return `<b>Disney+: </b>可访问${region ? ` ➟ ${flag(region)} ${region}` : ""} 🎉`;
  }

  return `<b>Disney+: </b>异常 ➟ HTTP ${code} ❗️`;
}

async function main() {
  const checks = [
    ["家里内网", checkHome],
    ["基础支持", checkProxy],
    ["GitHub", checkGitHub],
    ["Telegram", checkTelegram],
    ["ChatGPT", checkGPT],
    ["Gemini", checkGemini],
    ["YouTube", checkYouTube],
    ["Netflix", checkNetflix],
    ["Disney+", checkDisney]
  ];

  const results = await Promise.all(
    checks.map(item => runCheck(item[0], item[1]))
  );

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
