# WebXRメニューシステム - プロジェクト統合ガイド

## 🎯 概要

MRTalkプロジェクトに統合されたWebXRメニューシステムは、Mixed Reality (MR)
環境でのキャラクター情報表示とインタラクションを提供します。

## 🚀 主要実装成果

### Phase 1: 基本インフラストラクチャ

- ✅ **WebXRハンドトラッキングAPI統合** -
  [`HandTrackingManager.ts`](../app/lib/xr/hands/HandTrackingManager.ts)
- ✅ **Rock'n rollジェスチャー認識** -
  [`GestureRecognizer.ts`](../app/lib/xr/hands/GestureRecognizer.ts)
- ✅ **3D空間メニュー配置** -
  [`XRMenuSystem.tsx`](../app/components/xr/menu/XRMenuSystem.tsx)
- ✅ **型安全性確保** - [`HandTypes.ts`](../app/lib/xr/hands/types/HandTypes.ts)

### Phase 2: 3D UIシステム詳細化

- ✅ **@react-three/uikit統合** - 3D UI コンポーネント
- ✅ **キャラクター情報パネル** -
  [`CharacterInfoPanel.tsx`](../app/components/xr/menu/CharacterInfoPanel.tsx)
- ✅ **視線方向自動回転** - カメラ追従機能
- ✅ **パフォーマンス最適化** -
  [`useXRPerformance.ts`](../app/lib/xr/hooks/useXRPerformance.ts)

### Phase 3: 高度インタラクション

- ✅ **レイキャスティングシステム** -
  [`RaycastingManager.ts`](../app/lib/xr/interaction/RaycastingManager.ts)
- ✅ **統合インタラクション管理** -
  [`InteractionManager.ts`](../app/lib/xr/interaction/InteractionManager.ts)
- ✅ **高度ジェスチャー認識** - ピンチ、スワイプ、長押し対応
- ✅ **触覚フィードバック** - WebXR Haptics API統合
- ✅ **メニューナビゲーション** -
  [`MenuNavigator.tsx`](../app/components/xr/menu/MenuNavigator.tsx)

### Phase 4: VRM統合・最終最適化

- ✅ **VRMメニュー統合** -
  [`VRMMenuIntegration.ts`](../app/lib/xr/vrm/VRMMenuIntegration.ts)
- ✅ **メモリ管理システム** -
  [`MemoryManager.ts`](../app/lib/xr/core/MemoryManager.ts)
- ✅ **エラーハンドリング** -
  [`ErrorHandler.ts`](../app/lib/xr/core/ErrorHandler.ts)
- ✅ **VRMアニメーション連動** -
  [`AnimationManager.ts`](../app/lib/xr/vrm/AnimationManager.ts)

## 🏗️ アーキテクチャ構成

### ディレクトリ構造

```
app/lib/xr/
├── hands/                    # ハンドトラッキング
│   ├── HandTrackingManager.ts
│   ├── GestureRecognizer.ts
│   └── types/HandTypes.ts
├── interaction/              # インタラクション
│   ├── RaycastingManager.ts
│   └── InteractionManager.ts
├── vrm/                      # VRM統合
│   ├── VRMMenuIntegration.ts
│   └── AnimationManager.ts
├── core/                     # コアシステム
│   ├── MemoryManager.ts
│   └── ErrorHandler.ts
└── hooks/                    # React Hooks
    └── useXRPerformance.ts

app/components/xr/menu/       # UI コンポーネント
├── XRMenuSystem.tsx
├── CharacterInfoPanel.tsx
├── MenuController.tsx
└── MenuNavigator.tsx
```

### 主要クラスとコンポーネント

#### 1. `HandTrackingManager`

```typescript
// WebXR Hand Tracking APIの管理
const handTracking = HandTrackingManager.getInstance();
await handTracking.initialize(xrSession, referenceSpace);
const handData = handTracking.getHandData("left");
```

#### 2. `GestureRecognizer`

```typescript
// ジェスチャー認識
const recognizer = new GestureRecognizer();
recognizer.onGesture((gesture) => {
    if (gesture.type === "rock_n_roll") {
        toggleMenu();
    }
});
```

#### 3. `XRMenuSystem`

```tsx
// メインメニューシステム
<XRMenuSystem
    characters={characters}
    currentCharacter={currentCharacter}
    onCharacterSelect={setCurrentCharacter}
    onMenuAction={handleMenuAction}
/>;
```

## 🎮 操作方法

### ジェスチャー一覧

| ジェスチャー    | 動作                 | 説明                                   |
| --------------- | -------------------- | -------------------------------------- |
| **Rock'n roll** | メニュー表示/非表示  | 人差し指・小指を立て、中指・薬指を折る |
| **Point&Tap**   | アイテム選択         | 人差し指で指し、親指でタップ           |
| **ピンチ**      | 拡大縮小             | 親指と人差し指で挟む                   |
| **スワイプ**    | ページング           | 4方向への手の移動                      |
| **長押し**      | コンテキストメニュー | 800ms以上の静止                        |

### 操作フロー

1. **メニュー表示**: 左手でRock'n rollジェスチャー
2. **キャラクター選択**: Point&Tapでキャラクター情報パネルを選択
3. **詳細表示**: 長押しで詳細情報を展開
4. **VRM制御**: ピンチで表情・アニメーション制御

## 📊 パフォーマンス仕様

### 目標指標

- **フレームレート**: 60 FPS安定維持
- **メモリ使用量**: 200MB以下
- **ジェスチャー遅延**: 30ms以下
- **レイキャスト遅延**: 10ms以下
- **触覚フィードバック遅延**: 5ms以下

### 品質管理

```typescript
const performance = useXRPerformance({
    targetFPS: 60,
    memoryLimit: 200,
    enableAutoOptimization: true,
});

// リアルタイム監視
console.log("FPS:", performance.currentFPS);
console.log("Memory:", performance.memoryUsage);
```

## 🔧 開発者向け設定

### 基本統合

```tsx
import { XRMenuSystem } from "~/components/xr/menu/XRMenuSystem";
import { useXRPerformance } from "~/lib/xr/hooks/useXRPerformance";

export function TalkScene() {
    const performance = useXRPerformance();

    return (
        <XRMenuSystem
            characters={characters}
            currentCharacter={currentCharacter}
            onCharacterSelect={setCurrentCharacter}
            performanceConfig={performance}
        />
    );
}
```

### カスタマイズ例

```typescript
// ジェスチャー感度調整
const gestureConfig = {
    rockNRollThreshold: 0.8,
    pointTapThreshold: 0.9,
    pinchThreshold: 0.03,
};

// VRM統合設定
const vrmConfig = {
    enableGazeTracking: true,
    enableExpressionControl: true,
    animationBlendTime: 0.3,
};
```

## 🛠️ トラブルシューティング

### よくある問題と解決法

#### 1. ハンドトラッキングが動作しない

```bash
# WebXR対応確認
chrome://settings/content/additional-permissions

# デバッグモード有効化
const debug = useXRPerformance({ enableDebug: true });
```

#### 2. パフォーマンス低下

```typescript
// メモリ使用量確認
const memoryManager = MemoryManager.getInstance();
console.log("Memory usage:", memoryManager.getCurrentUsage());

// 品質調整
performance.setQualityLevel("medium");
```

#### 3. VRMキャラクターが表示されない

```typescript
// エラーハンドリング確認
const errorHandler = ErrorHandler.getInstance();
errorHandler.onError((error) => {
    console.log("VRM Error:", error);
});
```

## 📚 関連ドキュメント

- **技術設計書**: [`webxr-menu-system-design.md`](./webxr-menu-system-design.md)
- **使用方法ガイド**: [`webxr-menu-usage-guide.md`](./webxr-menu-usage-guide.md)
- **実装サマリー**:
  - [`PHASE2_IMPLEMENTATION_SUMMARY.md`](../PHASE2_IMPLEMENTATION_SUMMARY.md)
  - [`PHASE3_IMPLEMENTATION_SUMMARY.md`](../PHASE3_IMPLEMENTATION_SUMMARY.md)
  - [`PHASE4_IMPLEMENTATION_SUMMARY.md`](../PHASE4_IMPLEMENTATION_SUMMARY.md)

## 🌟 今後の拡張計画

### 短期計画

- [ ] 音声制御機能
- [ ] アイトラッキング連携
- [ ] カスタムジェスチャー定義

### 中長期計画

- [ ] マルチユーザー対応
- [ ] AI による個人最適化
- [ ] 他プラットフォーム対応

## 🤝 コントリビューション

### 開発環境セットアップ

```bash
# 依存関係インストール
bun install

# 開発サーバー起動
bun run dev

# WebXRデバッグ
# Meta Quest等のWebXR対応デバイスで確認
```

### テスト実行

```bash
# 型チェック
bun run type-check

# パフォーマンステスト
bun run test:performance
```

## 📞 サポート

- **GitHub Issues**: プロジェクトリポジトリ
- **テクニカルサポート**: MRTalk開発チーム
- **WebXR仕様**:
  [MDN WebXR Device API](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API)
