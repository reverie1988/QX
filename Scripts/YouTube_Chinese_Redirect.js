/*************************************
项目名称：YouTube 自动中文跳转
适用工具：Quantumult X
脚本类型：script-echo-response

功能说明：
- youtube.com / m.youtube.com 统一跳转到 www.youtube.com
- youtu.be 短链接跳转到 youtube.com/watch?v=
- 自动添加 hl=zh-CN，让 YouTube 页面显示中文
- 可选添加 gl=TW / HK / US 等地区参数
*************************************/

const LANGUAGE = "zh-CN";

// 可选地区参数：
// ""   = 不强制地区，只改语言
// "HK" = 偏香港地区
// "TW" = 偏台湾地区
// "US" = 偏美国地区
// "JP" = 偏日本地区
const REGION = "TW";

// 是否把 m.youtube.com / youtube.com 统一为 www.youtube.com
const FORCE_WWW = true;

const rawUrl = $request.url;
const url = new URL(rawUrl);
const host = url.hostname.toLowerCase();

url.protocol = "https:";

// youtu.be 短链接转换
if (host === "youtu.be") {
  const videoId = url.pathname.replace(/^\/+/, "");

  url.hostname = "www.youtube.com";
  url.pathname = "/watch";

  if (videoId) {
    url.searchParams.set("v", videoId);
  }
}

// youtube.com / m.youtube.com 统一到 www.youtube.com
if (
  FORCE_WWW &&
  (
    host === "youtube.com" ||
    host === "m.youtube.com"
  )
) {
  url.hostname = "www.youtube.com";
}

// www.youtube.com 正常保留
if (host === "www.youtube.com") {
  url.hostname = "www.youtube.com";
}

// music.youtube.com 不强制改成 www
// 只添加中文参数

// 添加中文界面参数
url.searchParams.set("hl", LANGUAGE);

// 可选：强制地区
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