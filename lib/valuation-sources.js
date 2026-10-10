const valuationSources = ["个人估计", "卡淘", "eBay", "Others"];
const valuationSourceLabels = { "个人估计": "个人估值", "卡淘": "卡淘成交", "eBay": "eBay成交", "Others": "Others" };
function canonicalValuationSource(source) {
  if (source === "近期成交") return "卡淘";
  if (source === "平台报价") return "Others";
  return source;
}
module.exports = { valuationSources, valuationSourceLabels, canonicalValuationSource };
