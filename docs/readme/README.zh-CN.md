# GitHub Copilot 的 Enhance Prompt

**0.2.4 新增：** 在本地保留 Copilot 用量记录，不含提示词或回复。将 Usage Insights 更新至 **0.1.64**，重启 Copilot，运行一次增强，再刷新 Usage Insights。独立会话将显示在 **Enhanced Prompt** 项目下。缺失费用不会显示为免费；已删除的旧记录无法恢复。[保存位置与限制](../copilot-background-rewriting.md#usage-visibility)。

**0.2.0 新增：** 在 Models 中选择 **GitHub Copilot** 预设，再从实时列表选择模型。插件使用桌面应用现有的 SDK 和运行时在后台改写，无需 npm、单独下载或 API 密钥。此预设中的 Claude 模型使用 Copilot 账户，而非 Claude Code。已有配置保持不变；在 Enhance 中选择 Copilot 配置即可使用。[详细说明和兼容性限制](../copilot-background-rewriting.md)。

结合项目文件、规则和 Git 变更，将请求改写为清晰的提示词。在原生画布中审阅结果，再发送到已连接的 Copilot 会话。

保留编辑器、模型链和回退、规则、结构、历史、附件和上下文预览。在 **Models** 中添加 API 模型或订阅 CLI。外部模型的费用不会由 Copilot 订阅承担。

画布发送新消息，不向终端输入按键。忙碌或等待回复的会话会拒绝发送。自动增强默认关闭，开启后可能修改在 Copilot 中输入的提示词。Windows 使用 DPAPI 保存密钥；其他平台暂不支持保存密钥。

参阅[安装和开发指南](../../README.md)、[隐私说明](../privacy.md)和[更新记录](../changelog/CHANGELOG.zh-CN.md)。

建议从 GitHub marketplace 安装。本地目录安装在 Copilot desktop 1.4.2 中可能只显示面板标志，而原生标签页仍缺少标志。请参阅[将本地安装切换到 GitHub 的步骤](../../README.md#repair-an-existing-local-installation)；仅新建会话并不能可靠修复此问题。

## 许可证与致谢

Enhance Prompt 最初由 [cattfan](https://github.com/cattfan) 在[原始项目](https://github.com/cattfan/orca-enhance-prompt)中创建。本分支基于原作者及贡献者的设计和实现，将其适配到 GitHub Copilot。

本分支按 [MIT 许可证](../../LICENSE) 分发，完整保留原始许可证及 `Copyright (c) 2026 cattfan` 声明。复制或分发此插件时，请附上该许可证，包括打包后的版本。
