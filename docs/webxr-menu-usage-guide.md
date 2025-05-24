# WebXRメニューシステム 使用方法ガイド

## 概要

WebXRでMixed Reality (MR)
アプリケーション用の独自メニューシステムです。ハンドトラッキングとジェスチャー認識を使用して、3D空間でキャラクター情報を直感的に操作できます。

## 主要機能

- **Rock'n rollジェスチャー**による メニュー表示・非表示切り替え
- **ハンドトラッキング**による 3D空間での操作
- **キャラクター情報パネル**の 3D表示
- **VRMキャラクター**との 完全統合
- **視線方向への自動回転**機能

## ジェスチャー操作

### 1. Rock'n rollジェスチャー（メニュー制御）

- **形状**: 人差し指と小指を立て、中指と薬指を折る
- **機能**: メニューの表示・非表示切り替え
- **検出時間**: 500ms継続で認識

### 2. Point&Tapジェスチャー（アイテム選択）

- **形状**: 人差し指で指し、親指でタップ
- **機能**: メニューアイテムの選択・実行
- **精度**: サブセンチメートル精度

### 3. ピンチジェスチャー（拡大縮小）

- **形状**: 親指と人差し指での挟み込み
- **機能**: メニューのサイズ調整
- **閾値**: 3cm以内で認識

### 4. スワイプジェスチャー（ページング）

- **方向**: 左右上下4方向
- **機能**: メニューページの切り替え
- **条件**: 10cm以上、0.5m/s以上の移動

### 5. 長押しジェスチャー（コンテキストメニュー）

- **動作**: 800ms以上の静止
- **機能**: 詳細メニューの表示

## 基本的な使用方法

### 1. プロジェクトへの統合

```tsx
import { XRMenuSystem } from "~/components/xr/menu/XRMenuSystem";

// TalkSceneなどでの使用例
<XRMenuSystem
    characters={characters}
    currentCharacter={currentCharacter}
    onCharacterSelect={handleCharacterSelect}
    onMenuAction={handleMenuAction}
/>;
```

### 2. キャラクター情報の表示

キャラクター情報パネルには以下が表示されます：

- キャラクター名
- 性格・説明
- 3D VRMアバター
- 統計情報
- お気に入り状態

### 3. VRMとの連携

メニュー操作に応じてVRMキャラクターが反応：

- メニュー表示時: キャラクターが注目
- ジェスチャー成功時: 反応アニメーション
- キャラクター選択時: 紹介アニメーション

## 開発者向け設定

### パフォーマンス調整

```tsx
import { useXRPerformance } from "~/lib/xr/hooks/useXRPerformance";

const performance = useXRPerformance({
    targetFPS: 60,
    memoryLimit: 200, // MB
    enableDebug: process.env.NODE_ENV === "development",
});
```

### メモリ管理

```tsx
import { MemoryManager } from "~/lib/xr/core/MemoryManager";

// 自動メモリ管理
const memoryManager = MemoryManager.getInstance();
memoryManager.setMemoryLimit(200); // MB
```

### エラーハンドリング

```tsx
import { ErrorHandler } from "~/lib/xr/core/ErrorHandler";

const errorHandler = ErrorHandler.getInstance();
errorHandler.setFallbackMode(true);
```

## カスタマイズ

### ジェスチャー感度の調整

```tsx
const gestureConfig = {
    rockNRollThreshold: 0.8,
    pointTapThreshold: 0.9,
    pinchThreshold: 0.03, // 3cm
    swipeMinDistance: 0.1, // 10cm
    longPressThreshold: 800, // ms
};
```

### メニューレイアウトの変更

```tsx
const menuConfig = {
    position: new Vector3(0, 1.5, -0.5),
    scale: new Vector3(1, 1, 1),
    autoRotate: true,
    followUser: true,
};
```

### VRM統合設定

```tsx
const vrmConfig = {
    enableGazeTracking: true,
    enableExpressionControl: true,
    animationBlendTime: 0.3,
};
```

## パフォーマンス指標

### 推奨仕様

- **フレームレート**: 60 FPS維持
- **メモリ使用量**: 200MB以下
- **ジェスチャー遅延**: 30ms以下
- **レイキャスト遅延**: 10ms以下

### 品質調整

システムは自動的に以下の品質レベルに調整されます：

- **High**: 高性能環境（60FPS、フル機能）
- **Medium**: 中性能環境（30FPS、機能制限）
- **Low**: 低性能環境（最小機能）

## トラブルシューティング

### よくある問題

#### 1. ハンドトラッキングが動作しない

- WebXR対応デバイス（Meta Quest等）で実行してください
- ブラウザでWebXRが有効になっているか確認してください
- 照明条件を改善してください（明るい環境推奨）

#### 2. ジェスチャーが認識されない

- 手を明確に視野に入れてください
- ジェスチャーを正確な形で500ms以上維持してください
- デバッグモードで認識状態を確認してください

#### 3. パフォーマンスが低下する

- メモリ使用量を確認してください（200MB以下推奨）
- 複数のVRMモデルを同時に読み込んでいないか確認してください
- 品質設定を下げてください

#### 4. VRMキャラクターが表示されない

- VRMファイルの形式とサイズを確認してください
- ネットワーク接続を確認してください
- エラーハンドラーのログを確認してください

### デバッグ機能

```tsx
// デバッグ情報の表示
const debugInfo = useXRPerformance({ enableDebug: true });

// コンソール出力
console.log("Hand tracking:", debugInfo.handTracking);
console.log("Gesture recognition:", debugInfo.gestureRecognition);
console.log("Performance:", debugInfo.performance);
```

## 今後の拡張予定

- **音声制御**: 音声コマンドによるメニュー操作
- **アイトラッキング**: 視線による選択機能
- **マルチユーザー**: 複数ユーザーでの同時操作
- **カスタムジェスチャー**: ユーザー定義ジェスチャー

## サポート

### 対応環境

- **デバイス**: Meta Quest 2/3/Pro
- **ブラウザ**: Chrome/Edge（WebXR対応）
- **フレームワーク**: React + Three.js + WebXR

### 技術サポート

- GitHub Issues: プロジェクトリポジトリ
- ドキュメント: `/docs/webxr-menu-system-design.md`
- 実装サマリー: `PHASE1-4_IMPLEMENTATION_SUMMARY.md`
