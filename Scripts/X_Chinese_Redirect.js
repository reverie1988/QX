/*************************************
项目名称：X / Twitter 自动中文跳转
适用工具：Quantumult X
脚本类型：script-echo-response

功能说明：
- twitter.com / mobile.twitter.com 跳转到 x.com
- www.x.com / mobile.x.com 统一跳转到 x.com
- 自动添加 lang=zh-Hans，让 X 页面尽量显示简体中文
*************************************/

// X 语言参数：
// "zh-Hans" = 简体中文
// "zh-Hant" = 繁体中文
// "en"      = 英文
// "ja"      = 日文
const LANGUAGE = "zh-Hans";

// 是否把 twitter.com 强制跳转到 x.com
const FORCE_X_DOMAIN = true;

const rawUrl = $request.url;
const url = new URL(rawUrl);
const host = url.hostname.toLowerCase();

url.protocol = "https:";

// Twitter 老域名跳转到 X
if (
  FORCE_X_DOMAIN &&
  (
    host === "twitter.com" ||
    host === "www.twitter.com" ||
    host === "mobile.twitter.com"
  )
) {
  url.hostname = "x.com";
}

// X 域名统一
if (
  host === "www.x.com" ||
  host === "mobile.x.com"
) {
  url.hostname = "x.com";
}

// 添加 X 网页语言参数
url.searchParams.set("lang", LANGUAGE);

const target = url.toString();

$done({
  status: "HTTP/1.1 302 Found",
  headers: {
    Location: target,
    "Cache-Control": "no-store"
  },
  body: ""
});