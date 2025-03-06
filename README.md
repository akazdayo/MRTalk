# MRTalk

[![technologies](https://skillicons.dev/icons?i=ts,tailwind,remix,threejs,prisma)](https://skillicons.dev)

MRTalk は、Meta Quest3 と Web ブラウザだけで、VRM や MMD のキャラクターと現実世界で音声会話をすることができる Web アプリです。

音声会話には、API を使用することができる OpenAI API キーが必要です。

# DEMO

![demo](public/img/demo.png)

# 動作確認済み環境

会話シーン

- Meta Quest3

キャラクターアップロード

- Windows11
- MacOS Sonoma 14.6.1

# Features

- 文字起こし API と GPT4o-mini を用いた音声会話
- 平面検出によりキャラクターが移動可能範囲を認識
- Three.js と WebXR Device API を用いた実装により Quest3 と標準ブラウザのみで実行可能
- キャラクターは PC やスマホのブラウザから登録可能
- キャラクターの公開/非公開を設定可能
- VRM モデルのアップロード機能
