console.log("Streaming Node Check start");

/***

For Quantumult-X 598+ ONLY

基于 KOP-XIAO streaming-ui-check.js 修改

用途：
在 Quantumult X 节点列表中，长按某一个节点，选择此脚本检测。

重点：
1. 只检测当前长按的这个节点
2. 使用 opts.policy = $environment.params
3. 不检测策略组链路
4. 不发送通知
5. 不显示地区
6. 成功统一显示 ✅

**/

const BASE_URL = "https://www.netflix.com/title/";
const BASE_URL_YTB = "https://www.youtube.com/premium";
const BASE_URL_DISNEY = "https://www.disneyplus.com";
const BASE_URL_Dazn = "https://startup.core.indazn.com/misl/v5/Startup";
const BASE_URL_Param = "https://www.paramountplus.com/";
const BASE_URL_Discovery_token = "https://us1-prod-direct.discoveryplus.com/token?deviceId=d1a4a5d25212400d1e6985984604d740&realm=go&shortlived=true";
const BASE_URL_Discovery = "https://us1-prod-direct.discoveryplus.com/users/me";
const BASE_URL_GPT = "https://chat.openai.com/";
const Region_URL_GPT = "https://chat.openai.com/cdn-cgi/trace";

const FILM_ID = 81280792;
const arrow = " ➟ ";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36";

const NODE = $environment.params || "当前节点";

var opts = {
  policy: NODE
};

var opts1 = {
  policy: NODE,
  redirection: false
};

let result = {
  title: "📺 节点服务查询",
  YouTube: "<b>YouTube Premium: </b>检测失败 ❗️",
  Netflix: "<b>Netflix: </b>检测失败 ❗️",
  Dazn: "<b>Dazn: </b>检测失败 ❗️",
  Disney: "<b>Disneyᐩ: </b>检测失败 ❗️",
  Paramount: "<b>Paramountᐩ: </b>检测失败 ❗️",
  Discovery: "<b>Discoveryᐩ: </b>检测失败 ❗️",
  ChatGPT: "<b>ChatGPT: </b>检测失败 ❗️"
};

const support_countryCodes = [
  "T1", "XX", "AL", "DZ", "AD", "AO", "AG", "AR", "AM", "AU", "AT", "AZ",
  "BS", "BD", "BB", "BE", "BZ", "BJ", "BT", "BA", "BW", "BR", "BG", "BF",
  "CV", "CA", "CL", "CO", "KM", "CR", "HR", "CY", "DK", "DJ", "DM", "DO",
  "EC", "SV", "EE", "FJ", "FI", "FR", "GA", "GM", "GE", "DE", "GH", "GR",
  "GD", "GT", "GN", "GW", "GY", "HT", "HN", "HU", "IS", "IN", "ID", "IQ",
  "IE", "IL", "IT", "JM", "JP", "JO", "KZ", "KE", "KI", "KW", "KG", "LV",
  "LB", "LS", "LR", "LI", "LT", "LU", "MG", "MW", "MY", "MV", "ML", "MT",
  "MH", "MR", "MU", "MX", "MC", "MN", "ME", "MA", "MZ", "MM", "NA", "NR",
  "NP", "NL", "NZ", "NI", "NE", "NG", "MK", "NO", "OM", "PK", "PW", "PA",
  "PG", "PE", "PH", "PL", "PT", "QA", "RO", "RW", "KN", "LC", "VC", "WS",
  "SM", "ST", "SN", "RS", "SC", "SL", "SG", "SK", "SI", "SB", "ZA", "ES",
  "LK", "SR", "SE", "CH", "TH", "TG", "TO", "TT", "TN", "TR", "TV", "UG",
  "AE", "US", "UY", "VU", "ZM", "BO", "BN", "CG", "CZ", "VA", "FM", "MD",
  "PS", "KR", "TW", "TZ", "TL", "GB"
];

function timeout(delay = 7000) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject("Timeout");
    }, delay);
  });
}

function stripHtml(text) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/br>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function safeRun(name, fn) {
  try {
    console.log("Start check: " + name);
    await Promise.race([fn(), timeout(8000)]);
    console.log("Finish check: " + name);
  } catch (e) {
    console.log(name + " error: " + e);

    if (e === "Timeout") {
      if (name === "YouTube") result.YouTube = "<b>YouTube Premium: </b>检测超时 🚦";
      if (name === "Netflix") result.Netflix = "<b>Netflix: </b>检测超时 🚦";
      if (name === "Disney") result.Disney = "<b>Disneyᐩ: </b>检测超时 🚦";
      if (name === "Dazn") result.Dazn = "<b>Dazn: </b>检测超时 🚦";
      if (name === "Paramount") result.Paramount = "<b>Paramountᐩ: </b>检测超时 🚦";
      if (name === "Discovery") result.Discovery = "<b>Discoveryᐩ: </b>检测超时 🚦";
      if (name === "ChatGPT") result.ChatGPT = "<b>ChatGPT: </b>检测超时 🚦";
    }
  }
}

async function testYTB() {
  let option = {
    url: BASE_URL_YTB,
    opts: opts,
    timeout: 5000,
    headers: {
      "User-Agent": UA
    }
  };

  try {
    let response = await $task.fetch(option);
    let data = response.body || "";

    console.log("ytb:" + response.statusCode);

    if (response.statusCode !== 200) {
      result.YouTube = "<b>YouTube Premium: </b>检测失败 ❗️";
      return;
    }

    if (
      data.indexOf("Premium is not available in your country") !== -1 ||
      data.indexOf("YouTube Premium is not available in your country") !== -1
    ) {
      result.YouTube = "<b>YouTube Premium: </b>未支持 🚫";
      return;
    }

    result.YouTube = "<b>YouTube Premium: </b>支持 ✅";
  } catch (e) {
    result.YouTube = "<b>YouTube Premium: </b>检测超时 🚦";
  }
}

async function testNf(filmId) {
  let option = {
    url: BASE_URL + filmId,
    opts: opts,
    timeout: 6000,
    headers: {
      "User-Agent": UA
    }
  };

  try {
    let response = await $task.fetch(option);

    console.log("nf:" + response.statusCode);

    if (response.statusCode === 404) {
      result.Netflix = "<b>Netflix: </b>支持自制剧集 ⚠️";
      return;
    }

    if (response.statusCode === 403) {
      result.Netflix = "<b>Netflix: </b>未支持 🚫";
      return;
    }

    if (response.statusCode === 200) {
      result.Netflix = "<b>Netflix: </b>完整支持 ✅";
      return;
    }

    result.Netflix = "<b>Netflix: </b>检测失败 ❗️";
  } catch (e) {
    result.Netflix = "<b>Netflix: </b>检测超时 🚦";
  }
}

async function testDisneyPlus() {
  try {
    await Promise.race([testHomePage(), timeout(7000)]);

    let locationInfo = await Promise.race([getLocationInfo(), timeout(7000)]);

    let inSupportedLocation = locationInfo.inSupportedLocation;

    if (inSupportedLocation === true || inSupportedLocation === "true") {
      result.Disney = "<b>Disneyᐩ: </b>支持 ✅";
      return;
    }

    if (inSupportedLocation === false || inSupportedLocation === "false") {
      result.Disney = "<b>Disneyᐩ: </b>即将登陆 ⚠️";
      return;
    }

    result.Disney = "<b>Disneyᐩ: </b>检测失败 ❗️";
  } catch (e) {
    console.log("Disney error:" + e);

    if (e === "Not Available") {
      result.Disney = "<b>Disneyᐩ: </b>未支持 🚫";
      return;
    }

    if (e === "Timeout") {
      result.Disney = "<b>Disneyᐩ: </b>检测超时 🚦";
      return;
    }

    result.Disney = "<b>Disneyᐩ: </b>检测异常 ❗️";
  }
}

function testHomePage() {
  return new Promise((resolve, reject) => {
    let option = {
      url: BASE_URL_DISNEY + "/",
      opts: opts,
      timeout: 5000,
      headers: {
        "Accept-Language": "en",
        "User-Agent": UA
      }
    };

    $task.fetch(option).then(response => {
      let data = response.body || "";

      console.log("Disney homepage:" + response.statusCode);

      if (
        response.statusCode !== 200 ||
        data.indexOf("not available in your region") !== -1 ||
        data.indexOf("not available in your country") !== -1
      ) {
        reject("Not Available");
        return;
      }

      resolve(true);
    }, reason => {
      reject("Error");
    });
  });
}

function getLocationInfo() {
  return new Promise((resolve, reject) => {
    let option = {
      url: "https://disney.api.edge.bamgrid.com/graph/v1/device/graphql",
      method: "POST",
      opts: opts,
      timeout: 7000,
      headers: {
        "Accept-Language": "en",
        "Authorization": "ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84",
        "Content-Type": "application/json",
        "User-Agent": UA
      },
      body: JSON.stringify({
        query: "mutation registerDevice($input: RegisterDeviceInput!) { registerDevice(registerDevice: $input) { grant { grantType assertion } } }",
        variables: {
          input: {
            applicationRuntime: "chrome",
            attributes: {
              browserName: "chrome",
              browserVersion: "94.0.4606",
              manufacturer: "apple",
              model: null,
              operatingSystem: "macintosh",
              operatingSystemVersion: "10.15.7",
              osDeviceIds: []
            },
            deviceFamily: "browser",
            deviceLanguage: "en",
            deviceProfile: "macosx"
          }
        }
      })
    };

    $task.fetch(option).then(response => {
      let data = response.body || "";

      console.log("Disney locationinfo:" + response.statusCode);

      if (response.statusCode !== 200) {
        reject("Not Available");
        return;
      }

      try {
        let json = JSON.parse(data);
        let sdk = json.extensions && json.extensions.sdk;

        if (!sdk || !sdk.session) {
          reject("Error");
          return;
        }

        resolve({
          inSupportedLocation: sdk.session.inSupportedLocation,
          countryCode: sdk.session.location ? sdk.session.location.countryCode : ""
        });
      } catch (e) {
        reject("Error");
      }
    }, reason => {
      reject("Error");
    });
  });
}

async function testDazn() {
  const body = JSON.stringify({
    LandingPageKey: "generic",
    Platform: "web",
    PlatformAttributes: {},
    Manufacturer: "",
    PromoCode: "",
    Version: "2"
  });

  let option = {
    url: BASE_URL_Dazn,
    method: "POST",
    opts: opts,
    timeout: 5000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.87 Safari/537.36",
      "Content-Type": "application/json"
    },
    body: body
  };

  try {
    let response = await $task.fetch(option);
    let data = response.body || "";

    console.log("Dazn:" + response.statusCode);

    if (response.statusCode !== 200) {
      result.Dazn = "<b>Dazn: </b>检测失败 ❗️";
      return;
    }

    let ret = new RegExp('"GeolocatedCountry":"(.*?)"', "gm").exec(data);

    if (ret && ret.length === 2) {
      result.Dazn = "<b>Dazn: </b>支持 ✅";
    } else {
      result.Dazn = "<b>Dazn: </b>未支持 🚫";
    }
  } catch (e) {
    result.Dazn = "<b>Dazn: </b>检测超时 🚦";
  }
}

async function testParam() {
  let option = {
    url: BASE_URL_Param,
    opts: opts1,
    timeout: 5000,
    headers: {
      "User-Agent": UA
    }
  };

  try {
    let response = await $task.fetch(option);

    console.log("Paramountᐩ:" + response.statusCode);

    if (response.statusCode === 200) {
      result.Paramount = "<b>Paramountᐩ: </b>支持 ✅";
      return;
    }

    if (response.statusCode === 302) {
      result.Paramount = "<b>Paramountᐩ: </b>未支持 🚫";
      return;
    }

    result.Paramount = "<b>Paramountᐩ: </b>检测失败 ❗️";
  } catch (e) {
    result.Paramount = "<b>Paramountᐩ: </b>检测超时 🚦";
  }
}

async function testDiscovery() {
  let option = {
    url: BASE_URL_Discovery_token,
    opts: opts1,
    timeout: 5000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.87 Safari/537.36"
    },
    verify: false
  };

  try {
    let response = await $task.fetch(option);

    console.log("Discovery GetToken:" + response.statusCode);

    if (response.statusCode !== 200) {
      result.Discovery = "<b>Discoveryᐩ: </b>检测失败 ❗️";
      return;
    }

    let data = JSON.parse(response.body || "{}");
    let token = data.data && data.data.attributes && data.data.attributes.token;

    if (!token) {
      result.Discovery = "<b>Discoveryᐩ: </b>检测失败 ❗️";
      return;
    }

    const cookievalid = `_gcl_au=1.1.858579665.1632206782; st=${token};`;

    let option1 = {
      url: BASE_URL_Discovery,
      opts: opts1,
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.87 Safari/537.36",
        "Cookie": cookievalid
      },
      ciphers: "DEFAULT@SECLEVEL=1",
      verify: false
    };

    let response1 = await $task.fetch(option1);

    console.log("Discovery Check:" + response1.statusCode);

    if (response1.statusCode !== 200) {
      result.Discovery = "<b>Discoveryᐩ: </b>检测失败 ❗️";
      return;
    }

    let data1 = JSON.parse(response1.body || "{}");
    let locationd = data1.data && data1.data.attributes && data1.data.attributes.currentLocationTerritory;

    if (locationd === "us") {
      result.Discovery = "<b>Discoveryᐩ: </b>支持 ✅";
    } else {
      result.Discovery = "<b>Discoveryᐩ: </b>未支持 🚫";
    }
  } catch (e) {
    result.Discovery = "<b>Discoveryᐩ: </b>检测超时 🚦";
  }
}

async function testChatGPT() {
  let option = {
    url: BASE_URL_GPT,
    opts: opts1,
    timeout: 5000,
    headers: {
      "User-Agent": UA
    }
  };

  try {
    let response = await $task.fetch(option);
    let resp = JSON.stringify(response);
    let body = response.body || "";

    console.log("ChatGPT Main Test:" + response.statusCode);

    if (
      body.indexOf("unsupported_country") !== -1 ||
      body.indexOf("not available in your country") !== -1 ||
      body.indexOf("OpenAI's services are not available in your country") !== -1
    ) {
      result.ChatGPT = "<b>ChatGPT: </b>未支持 🚫";
      return;
    }

    let jdg = resp.indexOf("text/plain");

    if (jdg !== -1) {
      result.ChatGPT = "<b>ChatGPT: </b>未支持 🚫";
      return;
    }

    let option1 = {
      url: Region_URL_GPT,
      opts: opts1,
      timeout: 5000,
      headers: {
        "User-Agent": UA
      }
    };

    let response1 = await $task.fetch(option1);

    console.log("ChatGPT Region Test:" + response1.statusCode);

    let region = "";

    try {
      region = response1.body.split("loc=")[1].split("\n")[0];
    } catch (e) {
      region = "";
    }

    if (region && support_countryCodes.indexOf(region) !== -1) {
      result.ChatGPT = "<b>ChatGPT: </b>支持 ✅";
      return;
    }

    if (response.statusCode >= 200 && response.statusCode < 400) {
      result.ChatGPT = "<b>ChatGPT: </b>疑似支持 ⚠️";
      return;
    }

    result.ChatGPT = "<b>ChatGPT: </b>未支持 🚫";
  } catch (e) {
    result.ChatGPT = "<b>ChatGPT: </b>检测超时 🚦";
  }
}

async function main() {
  await Promise.all([
    safeRun("YouTube", testYTB),
    safeRun("Netflix", async () => testNf(FILM_ID)),
    safeRun("Disney", testDisneyPlus),
    safeRun("Dazn", testDazn),
    safeRun("Paramount", testParam),
    safeRun("Discovery", testDiscovery),
    safeRun("ChatGPT", testChatGPT)
  ]);

  let content = [
    "--------------------------------------",
    result.ChatGPT,
    result.YouTube,
    result.Netflix,
    result.Disney,
    result.Dazn,
    result.Paramount,
    result.Discovery,
    "--------------------------------------",
    `<font color="#CD5C5C"><b>节点</b>${arrow}${escapeHtml(NODE)}</font>`
  ].join("</br></br>");

  content = `<p style="text-align:center;font-family:-apple-system;font-size:large;font-weight:thin">${content}</p>`;

  let plain = [
    "节点服务查询",
    "",
    stripHtml(result.ChatGPT),
    stripHtml(result.YouTube),
    stripHtml(result.Netflix),
    stripHtml(result.Disney),
    stripHtml(result.Dazn),
    stripHtml(result.Paramount),
    stripHtml(result.Discovery),
    "",
    "节点" + arrow + NODE
  ].join("\n");

  console.log("Streaming Node Check done");

  $done({
    title: result.title,
    content: plain,
    htmlMessage: content
  });
}

main().catch(e => {
  console.log("Main error:" + e);

  $done({
    title: result.title,
    content: "检测异常：" + e,
    htmlMessage: `<p style="text-align:center;font-family:-apple-system;font-size:large;font-weight:thin">--------------------------------------</br></br>🚥 检测异常</br></br>${escapeHtml(String(e))}</br></br>--------------------------------------</br></br><font color="#CD5C5C"><b>节点</b>${arrow}${escapeHtml(NODE)}</font></p>`
  });
});

