# WindowBox コンポーネント

`@react-three/uikit-apfel`を使用したWindow画面コンポーネント群です。MRアプリケーションで使用できる美しいウィンドウUIを提供します。

## 特徴

- **モダンなデザイン**: Apple風のデザインシステム
- **レスポンシブ**: さまざまなサイズに対応
- **カスタマイズ可能**: タイトル、サイズ、コンテンツを自由に設定
- **3D空間対応**: React Three Fiberで3D空間に配置可能
- **プリセット**: よく使われるウィンドウ構成を事前定義

## 基本的な使用方法

```tsx
import { WindowBox } from "~/components/xr/WindowBox";

function MyComponent() {
    return (
        <WindowBox
            title="マイウィンドウ"
            width={400}
            height={300}
            onClose={() => console.log("閉じられました")}
        >
            <div>ここにコンテンツを入れます</div>
        </WindowBox>
    );
}
```

## 利用可能なコンポーネント

### 1. WindowBox (基本ウィンドウ)

```tsx
<WindowBox
    title="基本ウィンドウ"
    width={400}
    height={300}
    closable={true}
    onClose={() => {}}
>
    {/* カスタムコンテンツ */}
</WindowBox>;
```

### 2. ChatWindow (チャット用ウィンドウ)

```tsx
<ChatWindow
    title="チャット"
    onClose={() => {}}
/>;
```

### 3. SettingsWindow (設定用ウィンドウ)

```tsx
<SettingsWindow
    title="設定"
    onClose={() => {}}
/>;
```

### 4. SystemInfoWindow (システム情報ウィンドウ)

```tsx
<SystemInfoWindow
    title="システム情報"
    onClose={() => {}}
/>;
```

## プロパティ

| プロパティ | 型        | デフォルト      | 説明                                 |
| ---------- | --------- | --------------- | ------------------------------------ |
| title      | string    | "MRTalk Window" | ウィンドウのタイトル                 |
| width      | number    | 400             | ウィンドウの幅                       |
| height     | number    | 300             | ウィンドウの高さ                     |
| closable   | boolean   | true            | 閉じるボタンの表示/非表示            |
| onClose    | function  | undefined       | 閉じるボタンクリック時のコールバック |
| children   | ReactNode | undefined       | ウィンドウ内に表示するコンテンツ     |

## MRシーンでの使用例

```tsx
import { Canvas } from "@react-three/fiber";
import { WindowBox } from "~/components/xr/WindowBox";

function MRScene() {
    return (
        <Canvas>
            <ambientLight intensity={0.5} />

            {/* 3D空間にウィンドウを配置 */}
            <group position={[0, 1, -2]}>
                <WindowBox title="MRウィンドウ">
                    <div>MR空間でのウィンドウ表示</div>
                </WindowBox>
            </group>
        </Canvas>
    );
}
```

## カスタマイズ例

```tsx
// ダークテーマのウィンドウ
<WindowBox
    title="ダークウィンドウ"
    backgroundColor="#2d3748"
    color="#ffffff"
>
    <div style={{ color: "white" }}>
        ダークテーマのコンテンツ
    </div>
</WindowBox>;
```

## 注意事項

- `@react-three/uikit`と`@react-three/uikit-apfel`がインストールされている必要があります
- 3D空間で使用する場合は、React Three
  Fiberの`Canvas`コンポーネント内で使用してください
- ウィンドウの位置は親要素の`group`で調整してください

## 開発者向け

新しいウィンドウタイプを追加する場合：

1. `WindowBox`をベースとして使用
2. 必要なプロパティを定義
3. コンテンツエリアをカスタマイズ
4. 型定義を適切に設定

例：

```tsx
export function MyCustomWindow(props: Omit<WindowBoxProps, "children">) {
    return (
        <WindowBox title="カスタム" {...props}>
            {/* カスタムコンテンツ */}
        </WindowBox>
    );
}
```
