/******************************

全球新闻速览 QX 版

功能：
- 彭博社 Bloomberg
- BBC
- 路透社 Reuters
- 美联社 AP
- 法新社 AFP
- 纽约时报 NYT
- 卫报 The Guardian
- 华尔街日报 WSJ
- 半岛电视台 Al Jazeera
- 金融时报 FT
- 日本经济新闻 Nikkei Asia
- 华盛顿邮报 Washington Post
- 福克斯新闻 Fox News
- MSNBC / MS NOW

每家获取最新 5 条新闻，翻译成中文后推送。
推送方式：所有内容固定分成 2 条推送。
显示格式：🇯🇵 【日本经济新闻 Nikkei Asia】
日志：打印每条推送内容。

推送开关：
pushWx: 1 开启 WxPusher，0 关闭
pushQx: 1 开启 QX 本地通知，0 关闭

[task_local]
event-interaction https://你的脚本地址/world-news-qx.js, tag=全球新闻速览, img-url=globe.system, enabled=true
0 8,20 * * * https://你的脚本地址/world-news-qx.js, tag=全球新闻速览推送, img-url=globe.system, enabled=true

******************************/


const CONFIG = {
  // 每家媒体获取数量
  limit: 10,

  // RSS、Google News、翻译请求走哪个策略
  fetchPolicy: "策略选择",

  // WxPusher 请求走哪个策略
  pushPolicy: "direct",

  // 是否翻译成中文
  translate: true,

  // 翻译并发，太高容易失败
  translateConcurrency: 3,

  // 摘要最大长度
  summaryMaxLength: 180,

  // 所有内容固定分成几条推送
  pushChunks: 2,

  // 是否推送到 WxPusher：1 开启，0 关闭
  pushWx: 0,

  // 是否推送到 QX 本地通知：1 开启，0 关闭
  pushQx: 0,

  // 单条 QX 本地通知最大长度
  localNotifyMaxLength: 6000,

  // 两条推送之间的间隔
  localNotifyDelay: 800,

  // WxPusher 配置
  // pushWx: 1 时才会使用
  wxpusherAppToken: "",

  // 例如：["UID_xxxxxxxxxxxxx"]
  wxpusherUids: []
};


function googleNewsSite(domain, keyword = "") {
  const q = encodeURIComponent(`site:${domain} ${keyword}`.trim());
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}


function googleNewsSearch(query) {
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}


const SOURCES = [
  {
    flag: "🇺🇸",
    name: "彭博社 Bloomberg",
    feeds: [
      googleNewsSearch('site:bloomberg.com/news when:2d -podcast -newsletter -"Bloomberg Weekend" -"Bloomberg Daybreak" -"Bloomberg Surveillance"'),
      "https://feeds.bloomberg.com/business/news.rss",
      "https://feeds.bloomberg.com/economics/news.rss",
      "https://feeds.bloomberg.com/technology/news.rss",
      "https://feeds.bloomberg.com/politics/news.rss",
      "https://feeds.bloomberg.com/markets/news.rss",
      googleNewsSite("bloomberg.com/news")
    ],
    excludeKeywords: [
      "Bloomberg Weekend",
      "Bloomberg Daybreak",
      "Bloomberg Surveillance",
      "Bloomberg Radio",
      "Bloomberg TV",
      "newsletter",
      "podcast",
      "radio",
      "TV"
    ]
  },
  {
    flag: "🇬🇧",
    name: "BBC",
    feeds: [
      "https://feeds.bbci.co.uk/news/world/rss.xml",
      "https://feeds.bbci.co.uk/news/rss.xml"
    ]
  },
  {
    flag: "🇬🇧",
    name: "路透社 Reuters",
    feeds: [
      googleNewsSite("reuters.com")
    ],
    excludeKeywords: [
      "Pictures",
      "Video",
      "Photos",
      "Graphics",
      "Reuters Pictures"
    ],
    excludeDomains: [
      "pictures.reuters.com"
    ]
  },
  {
    flag: "🇺🇸",
    name: "美联社 AP",
    feeds: [
      googleNewsSite("apnews.com")
    ],
    excludeKeywords: [
      "AP Photos",
      "AP Week",
      "Video",
      "Photo Gallery",
      "uat.apnews.com"
    ],
    excludeDomains: [
      "uat.apnews.com"
    ]
  },
  {
    flag: "🇫🇷",
    name: "法新社 AFP",
    feeds: [
      googleNewsSearch('"Agence France-Presse" when:2d -jobs -careers -"job openings" -"AFP Fact Check" -"AFP Factuel" -"fact check" -"press release" -PRNewswire -GlobeNewswire'),
      googleNewsSearch('"AFP" when:2d -"AFP Fact Check" -"AFP Factuel" -"Our job openings" -jobs -career -"press release" -LYCRA -PRNewswire -GlobeNewswire'),
      googleNewsSearch('site:barrons.com "AFP" when:2d -PRNewswire -GlobeNewswire'),
      googleNewsSearch('site:france24.com "AFP" when:2d'),
      googleNewsSearch('site:english.alarabiya.net "AFP" when:2d')
    ],
    excludeKeywords: [
      "job opening",
      "job openings",
      "vacancy",
      "careers",
      "AFP Fact Check",
      "AFP Factuel",
      "fact check",
      "press release",
      "PRNewswire",
      "GlobeNewswire",
      "LYCRA",
      "MediaConnect",
      "Our job openings",
      "AFP.com"
    ]
  },
  {
    flag: "🇺🇸",
    name: "纽约时报 NYT",
    feeds: [
      "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"
    ]
  },
  {
    flag: "🇬🇧",
    name: "卫报 The Guardian",
    feeds: [
      "https://www.theguardian.com/world/rss",
      "https://www.theguardian.com/international/rss"
    ]
  },
  {
    flag: "🇺🇸",
    name: "华尔街日报 WSJ",
    feeds: [
      "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
      "https://feeds.a.dj.com/rss/RSSMarketsMain.xml"
    ]
  },
  {
    flag: "🇶🇦",
    name: "半岛电视台 Al Jazeera",
    feeds: [
      "https://www.aljazeera.com/xml/rss/all.xml",
      googleNewsSite("aljazeera.com")
    ]
  },
  {
    flag: "🇬🇧",
    name: "金融时报 FT",
    feeds: [
      "https://www.ft.com/rss/home",
      "https://www.ft.com/rss/world",
      googleNewsSite("ft.com")
    ]
  },
  {
    flag: "🇯🇵",
    name: "日本经济新闻 Nikkei Asia",
    feeds: [
      "https://asia.nikkei.com/rss/feed/nar",
      googleNewsSite("asia.nikkei.com")
    ]
  },
  {
    flag: "🇺🇸",
    name: "华盛顿邮报 Washington Post",
    feeds: [
      "https://feeds.washingtonpost.com/rss/world",
      "https://feeds.washingtonpost.com/rss/politics",
      googleNewsSite("washingtonpost.com")
    ]
  },
  {
    flag: "🇺🇸",
    name: "福克斯新闻 Fox News",
    feeds: [
      "https://moxie.foxnews.com/google-publisher/latest.xml",
      "https://feeds.foxnews.com/foxnews/latest",
      googleNewsSite("foxnews.com")
    ]
  },
  {
    flag: "🇺🇸",
    name: "MSNBC / MS NOW",
    feeds: [
      googleNewsSearch('(site:msnbc.com OR site:ms.now) when:2d -podcast -video'),
      googleNewsSite("msnbc.com"),
      googleNewsSite("ms.now")
    ],
    excludeKeywords: [
      "Podcast",
      "Video",
      "Morning Joe",
      "Deadline",
      "The Rachel Maddow Show",
      "Opinion"
    ]
  }
];


main()
  .then(result => {
    $done({
      title: "全球新闻速览",
      htmlMessage: result.html
    });
  })
  .catch(err => {
    const msg = errorToString(err);

    $notify("全球新闻速览", "运行失败", msg);

    $done({
      title: "全球新闻速览",
      htmlMessage: `
        <div style="
          font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
          padding:12px;
          color:#dc3545;
          font-weight:700;
          line-height:1.5;
        ">
          运行失败：${escapeHtml(msg)}
        </div>
      `
    });
  });


async function main() {
  const blocks = await fetchAllSources();

  const jobs = [];

  blocks.forEach(block => {
    block.items.forEach(item => {
      jobs.push({
        block,
        item
      });
    });
  });

  if (CONFIG.translate) {
    await mapLimit(jobs, CONFIG.translateConcurrency, async job => {
      await translateItem(job.item);
    });
  } else {
    jobs.forEach(job => {
      job.item.titleCN = job.item.title;
      job.item.summaryCN = job.item.summary;
    });
  }

  const html = buildHtml(blocks);
  const plain = buildPlain(blocks);

  await pushResult(blocks, html, plain);

  return {
    html,
    plain
  };
}


async function fetchAllSources() {
  const tasks = SOURCES.map(source => fetchSource(source));
  return Promise.all(tasks);
}


async function fetchSource(source) {
  let lastError = "";
  const collected = [];
  const seen = new Set();
  let usedFeed = "";

  for (const feed of source.feeds) {
    try {
      const xml = await httpGet(feed, CONFIG.fetchPolicy);
      let items = parseFeed(xml);

      items = items
        .map(item => normalizeNewsItem(item))
        .filter(item => isValidNewsItem(item, source));

      for (const item of items) {
        const key = makeNewsKey(item);

        if (seen.has(key)) continue;

        seen.add(key);
        collected.push(item);

        if (collected.length >= CONFIG.limit) break;
      }

      if (!usedFeed && items.length > 0) {
        usedFeed = feed;
      }

      if (collected.length >= CONFIG.limit) break;

    } catch (e) {
      lastError = errorToString(e);
      console.log(`${source.flag || ""} ${source.name} 源失败：${feed}\n${lastError}`);
    }
  }

  return {
    flag: source.flag || "🌐",
    source: source.name,
    feed: usedFeed,
    error: lastError,
    items: collected.slice(0, CONFIG.limit)
  };
}


function normalizeNewsItem(item) {
  if (!item) return item;

  item.title = String(item.title || "")
    .replace(/\s+-\s+Bloomberg\s*$/i, "")
    .replace(/\s+-\s+Bloomberg\.com\s*$/i, "")
    .replace(/\s+-\s+Reuters\s*$/i, "")
    .replace(/\s+-\s+Reuters\.com\s*$/i, "")
    .replace(/\s+-\s+路透社\s*$/i, "")
    .replace(/\s+-\s+AP News\s*$/i, "")
    .replace(/\s+-\s+Associated Press\s*$/i, "")
    .replace(/\s+-\s+美联社新闻\s*$/i, "")
    .replace(/\s+-\s+uat\.apnews\.com\s*$/i, "")
    .replace(/\s+-\s+AFP\.com\s*$/i, "")
    .replace(/\s+-\s+Agence France-Presse\s*$/i, "")
    .replace(/\s+-\s+Barron's\s*$/i, "")
    .replace(/\s+-\s+Yahoo News\s*$/i, "")
    .replace(/\s+-\s+MSN\s*$/i, "")
    .replace(/\s+-\s+Google News\s*$/i, "")
    .replace(/\s+-\s+MSNBC\s*$/i, "")
    .replace(/\s+-\s+MS NOW\s*$/i, "")
    .trim();

  item.summary = String(item.summary || "")
    .replace(/\s+/g, " ")
    .trim();

  if (item.summary.length > CONFIG.summaryMaxLength) {
    item.summary = item.summary.slice(0, CONFIG.summaryMaxLength).trim() + "...";
  }

  return item;
}


function isValidNewsItem(item, source) {
  if (!item || !item.title) return false;

  const title = String(item.title || "").trim();
  const text = `${item.title} ${item.summary} ${item.link} ${item.sourceUrl || ""}`.toLowerCase();

  if (/^[-–—\s]*(reuters|ap news|associated press|uat\.apnews\.com|美联社新闻|路透社)?[-–—\s]*$/i.test(title)) {
    return false;
  }

  if (source.excludeKeywords && source.excludeKeywords.length > 0) {
    for (const word of source.excludeKeywords) {
      if (text.includes(String(word).toLowerCase())) {
        return false;
      }
    }
  }

  if (source.excludeDomains && source.excludeDomains.length > 0) {
    for (const domain of source.excludeDomains) {
      if (text.includes(String(domain).toLowerCase())) {
        return false;
      }
    }
  }

  if (title.length < 8) return false;

  return true;
}


function makeNewsKey(item) {
  const raw = item.link || item.title || "";
  return String(raw)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[#?].*$/, "")
    .trim();
}


function parseFeed(xml) {
  const items = [];
  const blocks = [];

  const itemReg = /<item[\s\S]*?<\/item>/gi;
  const entryReg = /<entry[\s\S]*?<\/entry>/gi;

  let m;

  while ((m = itemReg.exec(xml)) !== null) {
    blocks.push(m[0]);
  }

  while ((m = entryReg.exec(xml)) !== null) {
    blocks.push(m[0]);
  }

  for (const block of blocks) {
    const title = cleanText(getTag(block, "title"));

    const summaryRaw =
      getTag(block, "description") ||
      getTag(block, "summary") ||
      getTag(block, "encoded") ||
      getTag(block, "content") ||
      "";

    let summary = cleanText(summaryRaw);

    if (summary.length > CONFIG.summaryMaxLength) {
      summary = summary.slice(0, CONFIG.summaryMaxLength).trim() + "...";
    }

    const link = getLink(block);
    const sourceUrl = getSourceUrl(block);

    const pub =
      cleanText(getTag(block, "pubDate")) ||
      cleanText(getTag(block, "published")) ||
      cleanText(getTag(block, "updated")) ||
      cleanText(getTag(block, "date")) ||
      "";

    if (!title) continue;

    items.push({
      title,
      summary,
      link,
      sourceUrl,
      pub,
      titleCN: title,
      summaryCN: summary
    });
  }

  return items;
}


async function translateItem(item) {
  const title = item.title || "";
  const summary = item.summary || "";

  if (hasChinese(title + summary)) {
    item.titleCN = title;
    item.summaryCN = summary;
    return;
  }

  try {
    item.titleCN = await translateText(title);

    if (summary) {
      item.summaryCN = await translateText(summary);
    } else {
      item.summaryCN = "";
    }
  } catch (e) {
    console.log(`翻译失败：${item.title}\n${errorToString(e)}`);
    item.titleCN = title;
    item.summaryCN = summary;
  }
}


async function translateText(text) {
  if (!text) return "";

  const q = encodeURIComponent(text.slice(0, 4500));
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${q}`;

  const body = await httpGet(url, CONFIG.fetchPolicy, {
    Accept: "application/json,text/plain,*/*"
  });

  const data = JSON.parse(body);

  if (!data || !data[0]) return text;

  return data[0]
    .map(x => x && x[0] ? x[0] : "")
    .join("")
    .trim() || text;
}


async function pushResult(blocks, html, plain) {
  const chunks = splitBlocksIntoN(blocks, CONFIG.pushChunks);

  const enableWx =
    Number(CONFIG.pushWx) === 1 &&
    CONFIG.wxpusherAppToken &&
    CONFIG.wxpusherUids &&
    CONFIG.wxpusherUids.length > 0;

  const enableQx = Number(CONFIG.pushQx) === 1;

  if (Number(CONFIG.pushWx) === 1 && !enableWx) {
    console.log("WxPusher 推送开关已开启，但 wxpusherAppToken 或 wxpusherUids 未配置，已跳过 WxPusher 推送。");
  }

  if (!enableWx && !enableQx) {
    printPushContent("仅打印，不推送", plain);
    return;
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunkHtml = buildHtml(chunks[i]);
    const chunkPlain = buildPlain(chunks[i]);
    const content = truncateText(chunkPlain, CONFIG.localNotifyMaxLength);

    printPushContent(
      `推送内容 ${i + 1}/${chunks.length}`,
      chunkPlain
    );

    if (enableWx) {
      await pushWxPusher(
        `全球新闻速览 ${i + 1}/${chunks.length}`,
        chunkHtml
      );

      await sleep(1000);
    }

    if (enableQx) {
      $notify(
        `全球新闻速览 ${i + 1}/${chunks.length}`,
        `共 ${countItems(chunks[i])} 条新闻`,
        content
      );

      await sleep(CONFIG.localNotifyDelay);
    }
  }

  if (enableQx) {
    const wxStatus = enableWx ? "WxPusher 已推送" : "WxPusher 未推送";
    const qxStatus = enableQx ? "QX 已推送" : "QX 未推送";

    $notify(
      "全球新闻速览",
      "推送完成",
      `${wxStatus}；${qxStatus}；共 ${countItems(blocks)} 条新闻，已分成 ${chunks.length} 条`
    );
  }
}


async function pushWxPusher(title, content) {
  const url = "https://wxpusher.zjiecode.com/api/send/message";

  const payload = {
    appToken: CONFIG.wxpusherAppToken,
    content,
    summary: title,
    contentType: 2,
    uids: CONFIG.wxpusherUids
  };

  await httpPostJson(url, payload, CONFIG.pushPolicy);
}


function buildHtml(blocks) {
  const now = formatDate(new Date());

  let html = `
  <div style="
    font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
    font-size:14px;
    line-height:1.55;
    color:#111;
    padding:4px;
  ">
    <div style="font-size:20px;font-weight:700;margin-bottom:4px;">
      🌍 全球新闻速览
    </div>
    <div style="font-size:12px;color:#888;margin-bottom:10px;">
      更新时间：${escapeHtml(now)}
    </div>
  `;

  blocks.forEach(block => {
    html += `
      <hr style="border:0;border-top:1px solid #eee;margin:12px 0;">
      <div style="font-size:16px;font-weight:700;margin-bottom:8px;">
        ${escapeHtml(getSourceTitle(block))}
      </div>
    `;

    if (!block.items || block.items.length === 0) {
      html += `
        <div style="color:#999;font-size:13px;">
          未获取到内容
        </div>
      `;
      return;
    }

    html += `<ol style="padding-left:20px;margin:0;">`;

    block.items.forEach(item => {
      html += `
        <li style="margin-bottom:12px;">
          <div style="font-weight:700;">
            ${escapeHtml(item.titleCN || item.title)}
          </div>
      `;

      if (item.summaryCN) {
        html += `
          <div style="color:#444;margin-top:3px;">
            ${escapeHtml(item.summaryCN)}
          </div>
        `;
      }

      if (item.pub) {
        html += `
          <div style="color:#999;font-size:12px;margin-top:3px;">
            ${escapeHtml(item.pub)}
          </div>
        `;
      }

      if (item.link) {
        html += `
          <div style="font-size:13px;margin-top:3px;">
            <a href="${escapeHtml(item.link)}">查看原文</a>
          </div>
        `;
      }

      html += `</li>`;
    });

    html += `</ol>`;
  });

  html += `
    <hr style="border:0;border-top:1px solid #eee;margin:12px 0;">
    <div style="font-size:12px;color:#999;">
      说明：仅推送标题、摘要和原文链接；部分媒体可能受 RSS、地区、付费墙或访问限制影响。QX 本地通知有系统长度限制，完整内容以任务弹窗或 WxPusher 推送为准。
    </div>
  </div>
  `;

  return html;
}


function buildPlain(blocks) {
  let text = `全球新闻速览\n${formatDate(new Date())}\n\n`;

  blocks.forEach(block => {
    text += `${getSourceTitle(block)}\n`;

    if (!block.items || block.items.length === 0) {
      text += `未获取到内容\n\n`;
      return;
    }

    block.items.forEach((item, index) => {
      text += `${index + 1}. ${item.titleCN || item.title}\n`;
    });

    text += `\n`;
  });

  return text;
}


function getSourceTitle(block) {
  const flag = block.flag || "🌐";
  const name = block.source || "未知媒体";
  return `${flag} 【${name}】`;
}


function getTag(block, name) {
  const reg = new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${name}>`, "i");
  const m = block.match(reg);
  return m ? m[1] : "";
}


function getLink(block) {
  let m = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (m && m[1]) return decodeEntities(m[1].trim());

  m = block.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i);
  if (m && m[1]) return cleanText(m[1]);

  m = block.match(/<guid(?:\s[^>]*)?>(https?:\/\/[\s\S]*?)<\/guid>/i);
  if (m && m[1]) return cleanText(m[1]);

  return "";
}


function getSourceUrl(block) {
  const m = block.match(/<source[^>]*url=["']([^"']+)["'][^>]*>/i);
  if (m && m[1]) return decodeEntities(m[1].trim());
  return "";
}


function cleanText(str) {
  if (!str) return "";

  let s = String(str);

  s = s.replace(/<!\[CDATA\[/g, "");
  s = s.replace(/\]\]>/g, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  s = s.replace(/\s+/g, " ").trim();

  return s;
}


function decodeEntities(str) {
  if (!str) return "";

  return String(str)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, function(_, code) {
      return String.fromCharCode(Number(code));
    })
    .replace(/&#x([0-9a-fA-F]+);/g, function(_, code) {
      return String.fromCharCode(parseInt(code, 16));
    });
}


function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


function hasChinese(str) {
  return /[\u4e00-\u9fa5]/.test(str || "");
}


function httpGet(url, policy, headers = {}) {
  const req = {
    url,
    method: "GET",
    headers: Object.assign({
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "Accept": "application/rss+xml, application/xml, text/xml, application/json, text/plain, */*",
      "Cache-Control": "no-cache"
    }, headers),
    timeout: 15000
  };

  if (policy) {
    req.opts = {
      policy
    };
  }

  return $task.fetch(req).then(resp => {
    const code = Number(resp.statusCode || resp.status || 0);

    if (code >= 400) {
      throw new Error(`HTTP ${code}: ${url}`);
    }

    return resp.body || "";
  }, err => {
    throw new Error(`请求失败：${url}\n${errorToString(err)}`);
  });
}


function httpPostJson(url, payload, policy) {
  const req = {
    url,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0"
    },
    body: JSON.stringify(payload),
    timeout: 15000
  };

  if (policy) {
    req.opts = {
      policy
    };
  }

  return $task.fetch(req).then(resp => {
    const code = Number(resp.statusCode || resp.status || 0);

    if (code >= 400) {
      throw new Error(`WxPusher HTTP ${code}`);
    }

    return resp.body || "";
  }, err => {
    throw new Error(`WxPusher 请求失败：${errorToString(err)}`);
  });
}


async function mapLimit(arr, limit, fn) {
  const ret = [];
  let index = 0;

  async function worker() {
    while (index < arr.length) {
      const i = index++;

      try {
        ret[i] = await fn(arr[i], i);
      } catch (e) {
        ret[i] = null;
      }
    }
  }

  const workers = [];

  for (let i = 0; i < limit; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return ret;
}


function splitBlocksIntoN(blocks, n) {
  const result = [];
  const total = blocks.length;
  const size = Math.ceil(total / n);

  for (let i = 0; i < total; i += size) {
    result.push(blocks.slice(i, i + size));
  }

  return result;
}


function countItems(blocks) {
  return blocks.reduce((sum, block) => {
    return sum + (block.items ? block.items.length : 0);
  }, 0);
}


function truncateText(text, maxLength) {
  const s = String(text || "");

  if (s.length <= maxLength) return s;

  return s.slice(0, maxLength - 20).trim() + "\n……内容过长，已截断";
}


function printPushContent(title, content) {
  console.log("\n==============================");
  console.log(title);
  console.log("==============================");
  console.log(content);
  console.log("==============================\n");
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function formatDate(date) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());

  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}


function pad(n) {
  return n < 10 ? "0" + n : String(n);
}


function errorToString(e) {
  if (!e) return "未知错误";

  if (typeof e === "string") return e;

  if (e.message) return e.message;

  try {
    return JSON.stringify(e);
  } catch (_) {
    return String(e);
  }
}

