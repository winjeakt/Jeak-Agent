# Changelog

本文件记录 Jeak Agent 的重要变更，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [0.2.2] - 2026-08-26

- **重构**：将语言检测逻辑从 `src/renderer/monaco.ts` 抽离为纯函数模块 `src/shared/languageDetection.ts`（`extractExtension` / `matchLanguage` / `detectLanguage`），与 Monaco 解耦，便于单元测试。
- **修复**：`matchLanguage` 对大写扩展名（如 `.CPP`）匹配不健壮的问题，函数内部统一 `toLowerCase()` 后再比对。
- **测试**：新增 `languageDetection.test.ts`，共 12 个用例，模块语句/分支/函数/行覆盖率均达 100%。
- **依赖**：同步 `package-lock.json`，将 `monaco-editor` 转正为直接依赖。
