/******************************
 * Quantumult X 山东今日油价推送
 *
 * 数据源：
 * 汽车之家山东油价
 * https://www.autohome.com.cn/oil/371000.html
 *
 * 输出格式：
 * 2026年4月26日 / 星期日 20:11
 * 来源：汽车之家油价
 * 数据日期：2026年04月26日
 *
 * 92号汽油：¥8.42 / 升
 * 95号汽油：¥9.03 / 升
 * 98号汽油：¥10.03 / 升
 * 0号柴油：¥8.05 / 升
 *
 * 说明：这是山东油价指导价，各加油站可能有优惠或浮动，请以实际油站挂牌价为准。
 ******************************/

console.log("WeihaiOilPrice start");

const CONFIG = {
  TITLE: "威海今日油价",
  CITY: "山东威海",
  TIMEOUT: 15000,

  SOURCES: [
    {
      name: "汽车之家油价",
      url: "https://www.autohome.com.cn/oil/371000.html",
      type: "text"
    }
  ]
};

function fetchUrl(source) {
  return new Promise(resolve => {
    const req = {
      url: source.url,
      method: "GET",
      timeout: CONFIG.TIMEOUT,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh-Hans;q=0.9",
        "Connection": "keep-alive"
      }
    };

    $task.fetch(req).then(resp => {
      resolve({
        ok: resp.statusCode >= 200 && resp.statusCode < 400,
        statusCode: resp.statusCode,
        body: resp.body || "",
        source
      });
    }, err => {
      resolve({
        ok: false,
        statusCode: 0,
        body: "",
        error: stringifyError(err),
        source
      });
    });
  });
}

function stringifyError(err) {
  try {
    if (typeof err === "string") return err;
    return JSON.stringify(err);
  } catch (e) {
    return String(err);
  }
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<\/th>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePrice(v) {
  if (v === undefined || v === null) return "";

  const s = String(v).trim();
  const m = s.match(/\d+\.\d{1,2}/);

  return m ? m[0] : "";
}

function pickPrice(text, oilType) {
  const t = String(text || "");

  let patterns = [];

  if (oilType === "92") {
    patterns = [
      /92号汽油[^\d]{0,50}(\d+\.\d{1,2})/,
      /92#汽油[^\d]{0,50}(\d+\.\d{1,2})/,
      /92\s*[#号]?[^\d]{0,40}(\d+\.\d{1,2})/
    ];
  }

  if (oilType === "95") {
    patterns = [
      /95号汽油[^\d]{0,50}(\d+\.\d{1,2})/,
      /95#汽油[^\d]{0,50}(\d+\.\d{1,2})/,
      /95\s*[#号]?[^\d]{0,40}(\d+\.\d{1,2})/
    ];
  }

  if (oilType === "98") {
    patterns = [
      /98号汽油[^\d]{0,50}(\d+\.\d{1,2})/,
      /98#汽油[^\d]{0,50}(\d+\.\d{1,2})/,
      /98\s*[#号]?[^\d]{0,40}(\d+\.\d{1,2})/
    ];
  }

  if (oilType === "0") {
    patterns = [
      /0号柴油[^\d]{0,50}(\d+\.\d{1,2})/,
      /0#柴油[^\d]{0,50}(\d+\.\d{1,2})/,
      /柴油[^\d]{0,50}(\d+\.\d{1,2})/
    ];
  }

  for (const reg of patterns) {
    const m = t.match(reg);
    if (m && m[1]) return normalizePrice(m[1]);
  }

  return "";
}

function parseDate(text) {
  const t = String(text || "");

  let m =
    t.match(/(\d{4}年\d{1,2}月\d{1,2}日)/) ||
    t.match(/(\d{4}-\d{1,2}-\d{1,2})/) ||
    t.match(/(\d{4}\/\d{1,2}\/\d{1,2})/) ||
    t.match(/(\d{1,2}月\d{1,2}日24时调整)/);

  return m ? m[1] : "";
}

function parseTextSource(html) {
  const text = htmlToText(html);

  const result = {
    oil92: pickPrice(text, "92"),
    oil95: pickPrice(text, "95"),
    oil98: pickPrice(text, "98"),
    oil0: pickPrice(text, "0"),
    updateTime: parseDate(text)
  };

  if (!result.oil92 && !result.oil95 && !result.oil98 && !result.oil0) {
    return null;
  }

  return result;
}

function parseOilData(resp) {
  if (!resp || !resp.ok || !resp.body) return null;
  return parseTextSource(resp.body);
}

function nowText() {
  const d = new Date();
  const weeks = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const pad = n => String(n).padStart(2, "0");

  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 / ${weeks[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayDateText() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");

  return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日`;
}

function formatDateText(str) {
  if (!str) return todayDateText();

  const s = String(str);

  const m1 = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m1) {
    return `${m1[1]}年${String(m1[2]).padStart(2, "0")}月${String(m1[3]).padStart(2, "0")}日`;
  }

  const m2 = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m2) {
    return `${m2[1]}年${String(m2[2]).padStart(2, "0")}月${String(m2[3]).padStart(2, "0")}日`;
  }

  const m3 = s.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m3) {
    return `${m3[1]}年${String(m3[2]).padStart(2, "0")}月${String(m3[3]).padStart(2, "0")}日`;
  }

  return todayDateText();
}

function buildPlain(data, sourceName) {
  const lines = [];

  lines.push(nowText());
  lines.push(`来源：${sourceName}`);

  if (data.updateTime) {
    lines.push(`数据日期：${formatDateText(data.updateTime)}`);
  } else {
    lines.push(`数据日期：${todayDateText()}`);
  }

  lines.push("");

  if (data.oil92) lines.push(`92号汽油：¥${data.oil92} / 升`);
  if (data.oil95) lines.push(`95号汽油：¥${data.oil95} / 升`);
  if (data.oil98) lines.push(`98号汽油：¥${data.oil98} / 升`);
  if (data.oil0) lines.push(`0号柴油：¥${data.oil0} / 升`);

  lines.push("");
  lines.push("说明：这是山东威海油价指导价，各加油站可能有优惠或浮动，请以实际油站挂牌价为准。");

  return lines.join("\n");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(plain) {
  return `
    <pre style="
      font-size:15px;
      line-height:1.7;
      white-space:pre-wrap;
      font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;
      color:#222;
    ">${escapeHtml(plain)}</pre>
  `;
}

function notify(title, subtitle, body) {
  try {
    $notify(title, subtitle, body);
  } catch (e) {
    console.log("notify error: " + e);
  }
}

function done(content) {
  try {
    $done({
      title: "",
      content: content,
      htmlMessage: buildHtml(content)
    });
  } catch (e) {
    $done();
  }
}

async function main() {
  let failed = [];

  for (const source of CONFIG.SOURCES) {
    console.log(`Fetch source: ${source.name}`);

    const resp = await fetchUrl(source);

    if (!resp.ok) {
      failed.push(`${source.name}: status=${resp.statusCode}, error=${resp.error || ""}`);
      console.log(`Source failed: ${source.name}, status=${resp.statusCode}`);
      continue;
    }

    const data = parseOilData(resp);

    if (!data) {
      failed.push(`${source.name}: parse failed`);
      console.log(`Parse failed: ${source.name}`);
      continue;
    }

    console.log(`Source ok: ${source.name}`);

    const plain = buildPlain(data, source.name);

    console.log(plain);

    notify(CONFIG.TITLE, "", plain);
    done(plain);
    return;
  }

  const msg =
    "威海油价获取失败\n\n" +
    failed.join("\n") +
    "\n\n可能原因：网页结构变化、网络访问失败或源站暂时不可用。";

  console.log(msg);
  notify(CONFIG.TITLE, "获取失败", msg);
  done(msg);
}

main().catch(e => {
  const msg = "脚本异常：" + stringifyError(e);

  console.log(msg);
  notify(CONFIG.TITLE, "脚本异常", msg);
  done(msg);
});

