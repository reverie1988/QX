/******************************
 * Quantumult X 每日 60s 新闻推送
 * 文件名建议：Daily60sNews.js
 *
 * 功能：
 * 1. 抓取每天 60 秒读懂世界
 * 2. 推送 20 条新闻
 * 3. 显示日期、星期、每日金句
 * 4. 每日金句在 QX 页面中真正居中
 * 5. 普通通知文本中用空格模拟居中
 *
 * 新增：
 * 1. 打印完整推送内容到 QX 日志
 * 2. PUSH_QX 控制是否启用 QX 内部推送
 *
 * PUSH_QX: 1 开启 QX 内部通知
 * PUSH_QX: 0 关闭 QX 内部通知，仅打印日志和显示任务弹窗
 ******************************/

console.log("Daily60sNews start");

const CONFIG = {
  API_URL: "https://60s.viki.moe/v2/60s",
  API_TEXT_URL: "https://60s.viki.moe/v2/60s?encoding=text",

  MAX_NEWS: 20,
  TITLE: "每天 60s 读懂世界",
  TIMEOUT: 12000,

  // 是否开启 QX 内部通知推送：1 开启，0 关闭
  PUSH_QX: 1
};

function fetchData(url) {
  return new Promise(resolve => {
    const req = {
      url: url,
      method: "GET",
      timeout: CONFIG.TIMEOUT,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        "Accept": "application/json,text/plain,*/*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      }
    };

    const timer = setTimeout(() => {
      resolve({
        ok: false,
        statusCode: 0,
        body: "",
        error: "timeout"
      });
    }, CONFIG.TIMEOUT + 3000);

    $task.fetch(req).then(resp => {
      clearTimeout(timer);

      resolve({
        ok: resp.statusCode >= 200 && resp.statusCode < 400,
        statusCode: resp.statusCode,
        body: resp.body || "",
        error: ""
      });
    }, err => {
      clearTimeout(timer);

      resolve({
        ok: false,
        statusCode: 0,
        body: "",
        error: stringifyError(err)
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

function decodeHtml(str) {
  if (!str) return "";

  return String(str)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function cleanText(str) {
  if (!str) return "";

  return decodeHtml(str)
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getWeekday(dateStr) {
  let d;

  if (dateStr && /^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
    const arr = dateStr.split("-").map(Number);
    d = new Date(arr[0], arr[1] - 1, arr[2]);
  } else {
    d = new Date();
  }

  const weeks = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return weeks[d.getDay()];
}

function formatDateCN(dateStr) {
  let d;

  if (dateStr && /^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
    const arr = dateStr.split("-").map(Number);
    d = new Date(arr[0], arr[1] - 1, arr[2]);
  } else {
    d = new Date();
  }

  return `📅 ${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function centerLine(text, totalWidth = 34) {
  text = String(text || "").trim();

  const displayLength = text.replace(/[^\x00-\xff]/g, "xx").length;
  const spaceCount = Math.max(0, Math.floor((totalWidth * 2 - displayLength) / 4));

  return " ".repeat(spaceCount) + text;
}

function parseApiJson(body) {
  let json;

  try {
    json = JSON.parse(body);
  } catch (e) {
    console.log("JSON parse failed: " + e);
    return null;
  }

  const data = json.data || json.result || json;

  let news = data.news || data.list || data.items || data.content || [];

  if (typeof news === "string") {
    news = news
      .split(/\n+/)
      .map(x => cleanText(x))
      .filter(Boolean);
  }

  if (!Array.isArray(news)) {
    news = [];
  }

  news = news
    .map(item => {
      if (typeof item === "string") {
        return cleanText(item);
      }

      return cleanText(
        item.title ||
        item.content ||
        item.text ||
        item.desc ||
        item.name ||
        ""
      );
    })
    .filter(Boolean)
    .map(x => x.replace(/^\d+[、.．]\s*/, ""))
    .slice(0, CONFIG.MAX_NEWS);

  const date =
    data.date ||
    data.day ||
    data.today ||
    todayKey();

  const tip =
    data.tip ||
    data.saying ||
    data.quote ||
    data.weiyu ||
    data.sentence ||
    data.message ||
    data.hitokoto ||
    "";

  return {
    date,
    news,
    tip: cleanText(tip)
  };
}

function parseTextFallback(text) {
  const lines = cleanText(text)
    .split(/\n+/)
    .map(x => x.trim())
    .filter(Boolean);

  const news = [];
  let tip = "";

  for (const line of lines) {
    const cleaned = line
      .replace(/^\d+[、.．]\s*/, "")
      .replace(/^[-*]\s*/, "")
      .trim();

    if (
      cleaned.includes("每日金句") ||
      cleaned.includes("每日微语") ||
      cleaned.includes("金句")
    ) {
      continue;
    }

    if (
      cleaned.startsWith("🔆") ||
      cleaned.startsWith("「") ||
      cleaned.startsWith("“")
    ) {
      tip = cleaned.replace(/^🔆\s*/, "").replace(/^「|」$/g, "");
      continue;
    }

    if (
      cleaned.length >= 8 &&
      !cleaned.includes("每天") &&
      !cleaned.includes("读懂世界") &&
      !cleaned.includes("更新") &&
      news.length < CONFIG.MAX_NEWS
    ) {
      news.push(cleaned);
    }
  }

  return {
    date: todayKey(),
    news,
    tip
  };
}

function buildPlain(data) {
  const dateText = formatDateCN(data.date);
  const weekText = getWeekday(data.date);

  const lines = [];

  lines.push(`${dateText} / ${weekText}`);
  lines.push("");

  data.news.forEach((item, index) => {
    lines.push(`${index + 1}. ${item}`);
    lines.push("");
  });

  if (data.tip) {
    lines.push("");
    lines.push(centerLine("【每日金句】", 42));
    lines.push("");
    lines.push(centerLine("🔆 " + data.tip, 34));
    lines.push("");
  }

  return lines.join("\n").trim();
}

function buildHtml(data) {
  const dateText = formatDateCN(data.date);
  const weekText = getWeekday(data.date);

  const newsHtml = data.news.map((item, index) => {
    return `
      <div style="
        margin: 0 0 16px 0;
        line-height: 1.7;
        font-size: 16px;
        font-weight: 600;
        color: #222;
      ">
        ${index + 1}. ${escapeHtml(item)}
      </div>
    `;
  }).join("");

  const tipHtml = data.tip
    ? `
      <div style="margin-top: 34px; text-align: center;">
        <div style="
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 2px;
          color: #333;
          margin-bottom: 14px;
        ">
          【每日金句】
        </div>
        <div style="
          font-size: 16px;
          line-height: 1.8;
          font-weight: 600;
          color: #333;
          padding: 0 10px;
        ">
          🔆 ${escapeHtml(data.tip)}
        </div>
      </div>
    `
    : "";

  return `
    <div style="
      font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
      padding: 18px;
      background: #fffdf6;
      color: #222;
    ">
      <div style="text-align: left; margin-bottom: 22px;">
        <div style="
          font-size: 24px;
          font-weight: 900;
          margin-bottom: 8px;
        ">
          每天 <span style="color:#d98b00;">60s</span> 读懂世界
        </div>
        <div style="
          font-size: 15px;
          color: #666;
          font-weight: 600;
        ">
          ${escapeHtml(dateText)} / ${escapeHtml(weekText)}
        </div>
      </div>

      <div>
        ${newsHtml}
      </div>

      ${tipHtml}
    </div>
  `;
}

function printPushContent(title, subtitle, body) {
  console.log("\n==============================");
  console.log("QX 推送内容");
  console.log("==============================");
  console.log("标题：" + (title || ""));
  console.log("副标题：" + (subtitle || ""));
  console.log("正文：");
  console.log(body || "");
  console.log("==============================\n");
}

function notify(title, subtitle, body) {
  try {
    printPushContent(title, subtitle, body);

    if (Number(CONFIG.PUSH_QX) !== 1) {
      console.log("QX 内部通知推送已关闭，仅打印日志，不发送 $notify。");
      return;
    }

    $notify(title, subtitle, body);
  } catch (e) {
    console.log("notify error: " + e);
  }
}

function done(title, content, html) {
  try {
    $done({
      title: title,
      content: content,
      htmlMessage: html
    });
  } catch (e) {
    $done();
  }
}

async function main() {
  let result = null;

  const jsonResp = await fetchData(CONFIG.API_URL);

  if (jsonResp.ok && jsonResp.body) {
    result = parseApiJson(jsonResp.body);
  } else {
    console.log(`JSON API failed: status=${jsonResp.statusCode || ""}, error=${jsonResp.error || ""}`);
  }

  if (!result || !result.news || result.news.length === 0) {
    const textResp = await fetchData(CONFIG.API_TEXT_URL);

    if (textResp.ok && textResp.body) {
      result = parseTextFallback(textResp.body);
    } else {
      console.log(`Text API failed: status=${textResp.statusCode || ""}, error=${textResp.error || ""}`);
    }
  }

  if (!result || !result.news || result.news.length === 0) {
    const msg = "每日新闻获取失败，可能是接口暂未更新、网络异常或 API 无法访问。";

    console.log(msg);
    notify(CONFIG.TITLE, "获取失败", msg);
    done(CONFIG.TITLE, msg, `<p>${escapeHtml(msg)}</p>`);

    return;
  }

  const plain = buildPlain(result);
  const html = buildHtml(result);

  notify(CONFIG.TITLE, "", plain);

  console.log("Daily60sNews done");

  done(CONFIG.TITLE, plain, html);
}

main().catch(e => {
  const msg = "脚本异常：" + stringifyError(e);

  console.log(msg);
  notify(CONFIG.TITLE, "脚本异常", msg);
  done(CONFIG.TITLE, msg, `<p>${escapeHtml(msg)}</p>`);
});
