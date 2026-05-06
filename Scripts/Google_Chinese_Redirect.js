/*************************************
项目名称：Google 自动中文跳转
适用工具：Quantumult X
脚本类型：script-echo-response
功能说明：
- google.cn / g.cn 跳转到 google.com
- ditu.google.cn / maps.google.cn 跳转到 maps.google.com
- 自动添加 hl=zh-CN，让 Google 页面显示中文
*************************************/

const LANGUAGE = "zh-CN";

// 可选地区参数：
// ""   = 不强制地区，只改语言
// "HK" = 偏香港地区
// "TW" = 偏台湾地区
// "CN" = 偏中国大陆地区
const REGION = "HK";

const rawUrl = $request.url;
const url = new URL(rawUrl);
const host = url.hostname.toLowerCase();

url.protocol = "https:";

// Google CN 跳 Google.com
if (
  host === "g.cn" ||
  host === "google.cn" ||
  host === "www.google.cn"
) {
  url.hostname = "www.google.com";
}

// Google 地图 CN 跳 maps.google.com
if (
  host === "ditu.google.cn" ||
  host === "maps.google.cn"
) {
  url.hostname = "maps.google.com";
}

// 统一 google.com 为 www.google.com
if (host === "google.com") {
  url.hostname = "www.google.com";
}

// 添加中文界面参数
url.searchParams.set("hl", LANGUAGE);

// 可选：强制搜索地区
if (REGION) {
  url.searchParams.set("gl", REGION);
}

const target = url.toString();

$done({
  status: "HTTP/1.1 302 Found",
  headers: {
    Location: target,
    "Cache-Control": "no-store"
  },
  body: ""
});