# MiniMax 用量看板 (Kindle 版)

把吃灰的 Kindle 变成 AI 额度监控屏。这里是 GitHub Pages 的实际部署内容,只显示
**MiniMax (M3 / Token Plan)** 一家 — 界面做了精简(去掉 Claude / Codex / Kimi / DeepSeek,
去掉每日一语),只留两个模块:宁波天气 + MiniMax 用量(大数字 + 5h/周/月窗口)。

- **平台**: MiniMax (海螺 AI / MiniMax-M3)
- **采集端点**: `https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains`
- **认证**: Bearer token(本地采集器读取,推上来的 `data.js` / `data.json` 里只含脱敏后的百分比)
- **天气**: Open-Meteo(免 key),宁波

## 部署
1. 这个仓库根目录被 GitHub Pages 静态托管。
2. 上游电脑每 ~3 分钟采集一次 MiniMax 额度,生成 `data.js` / `data.json`,推上来。

## 推到 Kindle
- 走 KPM / .kpkg 标准安装流程(参考上游项目文档)。
- 装好后,Kindle 浏览器每 3 分钟从 GitHub Pages 拉 `data.js`,局部刷新显示。

## 本地预览
```bash
# 拉下来跑个静态服务就行
npx http-server -p 8787
# 打开 http://127.0.0.1:8787
```
