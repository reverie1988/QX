/***
[task_local]
event-interaction https://你的脚本地址/server-info-pure.js, tag=节点纯度检测, img-url=checkmark.shield.fill.system, enabled=true

@Description: 使用 IPPure API 查询当前 QX 节点出口 IP、ASN、地区、风险分数和纯度
@Update: 2026-04-26
***/

const API_URL = "https://my.ippure.com/v1/info";
const POLICY = ($environment && $environment.params) ? String($environment.params).trim() : "";

const request = {
  url: API_URL,
  method: "GET",
  headers: {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Accept": "application/json,text/plain,*/*",
    "Cache-Control": "no-cache"
  },
  timeout: 8000
};

if (POLICY) {
  request.opts = {
    policy: POLICY
  };
}

$task.fetch(request).then(resp => {
  try {
    if (!resp || !resp.body) {
      return finishError("接口无返回数据");
    }

    const data = JSON.parse(resp.body);
    const htmlMessage = buildHtml(data);

    $done({
      title: "节点纯度检测",
      htmlMessage
    });

  } catch (e) {
    finishError("数据解析失败");
  }
}, err => {
  finishError("查询失败或超时");
});


function buildHtml(data) {
  const ip = safe(data.ip);
  const countryCode = safe(data.countryCode);
  const flag = getFlagEmoji(countryCode);
  const region = safe(data.region);
  const city = safe(data.city);

  const asn = data.asn ? `AS${data.asn}` : "N/A";
  const isp = safe(data.asOrganization || data.isp || data.org);

  const score = numberValue(data.fraudScore, 0);

  const isResidential = boolValue(data.isResidential);
  const isHosting = boolValue(data.isHosting);
  const isProxy = boolValue(data.isProxy);
  const isVpn = boolValue(data.isVpn || data.isVPN);
  const isTor = boolValue(data.isTor);
  const isMobile = boolValue(data.isMobile);

  let location = `${flag} ${countryCode || "N/A"}`;
  if (region !== "N/A") location += ` - ${region}`;
  if (city !== "N/A") location += ` - ${city}`;

  const netType = getNetworkType({
    isResidential,
    isHosting,
    isProxy,
    isVpn,
    isTor,
    isMobile
  });

  const risk = getRiskLevel(score);
  const pure = getPureLevel(score, {
    isResidential,
    isHosting,
    isProxy,
    isVpn,
    isTor,
    isMobile
  });

  const rows = [
    ["出口 IP", ip],
    ["位置", location],
    ["ASN", asn],
    ["运营商", isp],
    ["网络类型", netType],
    ["欺诈分数", `${score} / 100`],
    ["风险等级", risk],
    ["纯度判断", pure],
    ["住宅 IP", yesNo(isResidential, false)],
    ["机房 IP", yesNo(isHosting, true)],
    ["代理识别", yesNo(isProxy, true)],
    ["VPN 识别", yesNo(isVpn, true)],
    ["Tor 识别", yesNo(isTor, true)],
    ["移动网络", yesNo(isMobile, false)]
  ];

  let html = `
  <div style="
    font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
    font-size:14px;
    line-height:1.45;
    color:#111;
    padding:2px 4px 0 4px;
  ">
  `;

  html += `
    <div style="
      text-align:center;
      margin:0 0 10px 0;
      padding:8px 10px;
      border-radius:12px;
      background:#f3f4f6;
    ">
      <div style="font-size:18px;font-weight:700;color:#111;word-break:break-all;">
        ${ip}
      </div>
      <div style="font-size:13px;color:#666;margin-top:3px;word-break:break-all;">
        ${location}
      </div>
    </div>
  `;

  html += `
    <table style="
      width:100%;
      border-collapse:collapse;
      table-layout:fixed;
    ">
  `;

  rows.forEach(([key, value], index) => {
    html += `
      <tr>
        <td style="
          width:34%;
          padding:6px 0;
          color:#666;
          font-weight:600;
          text-align:left;
          border-bottom:${index === rows.length - 1 ? "0" : "1px solid #eeeeee"};
        ">
          ${escapeHtml(key)}
        </td>
        <td style="
          width:66%;
          padding:6px 0;
          color:#111;
          text-align:right;
          word-break:break-all;
          border-bottom:${index === rows.length - 1 ? "0" : "1px solid #eeeeee"};
        ">
          ${value}
        </td>
      </tr>
    `;
  });

  html += `
    </table>

    <div style="
      margin-top:12px;
      padding-top:8px;
      border-top:1px solid #eeeeee;
      text-align:center;
      color:#5b5fc7;
      font-size:13px;
      font-weight:600;
      word-break:break-all;
    ">
      节点 ➟ ${escapeHtml(POLICY || "当前默认策略")}
    </div>

    <div style="
      margin-top:5px;
      text-align:center;
      color:#999;
      font-size:12px;
    ">
      结果仅代表当前出口 IP，节点切换后需重新检测
    </div>
  </div>
  `;

  return html;
}


function getNetworkType(info) {
  if (info.isTor) return "<font color='#dc3545'><b>Tor 网络</b></font>";
  if (info.isProxy || info.isVpn) return "<font color='#ff8c00'><b>代理 / VPN</b></font>";
  if (info.isResidential) return "<font color='#28a745'><b>住宅网络</b></font>";
  if (info.isMobile) return "<font color='#28a745'><b>移动网络</b></font>";
  if (info.isHosting) return "<font color='#ff8c00'><b>数据中心 / 机房</b></font>";
  return "<font color='#666'>未知类型</font>";
}


function getRiskLevel(score) {
  if (score <= 20) return "<font color='#28a745'><b>低风险</b></font>";
  if (score <= 45) return "<font color='#d8a600'><b>中低风险</b></font>";
  if (score <= 70) return "<font color='#ff8c00'><b>高风险</b></font>";
  return "<font color='#dc3545'><b>极高风险</b></font>";
}


function getPureLevel(score, info) {
  if (info.isTor) {
    return "<font color='#dc3545'><b>极低</b></font>";
  }

  if (info.isProxy || info.isVpn) {
    if (score <= 35) {
      return "<font color='#d8a600'><b>一般</b></font>";
    }
    return "<font color='#dc3545'><b>偏低</b></font>";
  }

  if (info.isResidential || info.isMobile) {
    if (score <= 25) {
      return "<font color='#28a745'><b>较高</b></font>";
    }
    if (score <= 50) {
      return "<font color='#d8a600'><b>中等</b></font>";
    }
    return "<font color='#ff8c00'><b>偏低</b></font>";
  }

  if (info.isHosting) {
    if (score <= 25) {
      return "<font color='#28a745'><b>较干净</b></font>";
    }
    return "<font color='#ff8c00'><b>机房风险偏高</b></font>";
  }

  if (score <= 25) {
    return "<font color='#28a745'><b>较干净</b></font>";
  }

  if (score <= 50) {
    return "<font color='#d8a600'><b>一般</b></font>";
  }

  return "<font color='#dc3545'><b>偏低</b></font>";
}


function yesNo(value, badWhenTrue) {
  if (value) {
    return badWhenTrue
      ? "<font color='#dc3545'><b>是</b></font>"
      : "<font color='#28a745'><b>是</b></font>";
  }

  return badWhenTrue
    ? "<font color='#28a745'>否</font>"
    : "<font color='#666'>否</font>";
}


function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode === "N/A") return "🌍";

  try {
    return countryCode
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .split("")
      .map(char => String.fromCodePoint(127397 + char.charCodeAt()))
      .join("");
  } catch (e) {
    return "🌍";
  }
}


function boolValue(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}


function numberValue(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}


function safe(value) {
  if (value === undefined || value === null || value === "") return "N/A";
  return escapeHtml(String(value));
}


function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


function finishError(msg) {
  const htmlMessage = `
  <div style="
    text-align:center;
    font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
    padding:12px;
  ">
    <div style="font-size:17px;font-weight:700;color:#dc3545;">${escapeHtml(msg)}</div>
    <div style="font-size:13px;color:#999;margin-top:8px;">
      请检查节点、网络或 IPPure 接口状态
    </div>
    <div style="font-size:13px;color:#5b5fc7;margin-top:8px;word-break:break-all;">
      节点 ➟ ${escapeHtml(POLICY || "当前默认策略")}
    </div>
  </div>
  `;

  $done({
    title: "节点纯度检测",
    htmlMessage
  });
}

