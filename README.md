# MRTalk

[![technologies](https://skillicons.dev/icons?i=ts,tailwind,remix,threejs,prisma)](https://skillicons.dev)

MRTalkは、WebXRとVRM技術を活用したMixed Reality (MR)
対話アプリケーションです。革新的なハンドトラッキングメニューシステムにより、3D空間でキャラクターと直感的に対話できます。

## 🌟 主要機能

- **WebXRハンドトラッキング**: Rock'n rollジェスチャーによる3Dメニュー制御
- **VRMキャラクター統合**: リアルタイムアニメーション・表情制御
- **Mixed Reality対話**: 3D空間でのキャラクター情報表示
- **高精度インタラクション**: ピンチ、スワイプ、長押しジェスチャー対応
- **音声合成 (GPT-SoVITS)**: 高品質な音声生成システム

## 🎮 WebXRメニューシステム

革新的なハンドトラッキングメニューシステムを実装：

- **Rock'n rollジェスチャー** でメニュー表示・非表示
- **Point&Tap** でアイテム選択
- **視線追従機能** で最適なメニュー配置
- **60FPS** 安定動作と **200MB以下** のメモリ効率

詳細な使用方法: [WebXRメニューシステム ガイド](docs/README_WEBXR_MENU.md)

# DEMO

![demo](public/img/demo.png)

# self host

## Requirements

- [marukun712/MRTalk](https://github.com/marukun712/MRTalk)
- [marukun712/MRTalk-GPT-SoVITS](https://github.com/marukun712/MRTalk-GPT-SoVITS)

## MRTalk

### Google OAuth

GCPでOAuthのクライアントIDを取得して、.envに設定してください。\
承認済みのリダイレクトURIは、`http://ドメイン名/api/auth/callback/google`を設定する必要があります。\
cloudflare-tunnelまたはngrok等を用いてローカルホストを公開する必要があります。(VRからアクセスする場合)\
ngrokを用いる場合は、ドメインを固定してください。 \

### Setup

./ai-assistant/README.mdも参照してください。

```bash
$ mise i
$ bun i
$ cp .env.example .env

$ bun run prisma generate
$ bun run prisma db push

$ bun run dev
```

## MRTalk-GPT-SoVITS

GPT SoVITS works with Google Colab free plan.
https://colab.research.google.com/drive/1RbVjXdGPCFAOSOhVj3OhblazhAI057fT
