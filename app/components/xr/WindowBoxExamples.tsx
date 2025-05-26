import React from 'react'
import { Canvas } from '@react-three/fiber'
import { Container, Text } from '@react-three/uikit'
import { WindowBoxExample, WindowBox, ChatWindow, SettingsWindow, SystemInfoWindow } from './WindowBox'

/**
 * WindowBox使用例のサンプルコンポーネント
 * MRアプリケーションでの様々なWindow画面の実装例を示します
 */

// 基本的なWindowBoxの使用例
export function BasicWindowExample() {
    return (
        <WindowBox
            title="基本ウィンドウ"
            width={300}
            height={200}
        >
            <Container flexDirection="column" gap={8}>
                <Text fontSize={14}>これは基本的なウィンドウの例です。</Text>
                <Text fontSize={14}>任意のコンテンツを表示できます。</Text>
            </Container>
        </WindowBox>
    )
}

// カスタムウィンドウの例
export function CustomWindowExample() {
    return (
        <WindowBox
            title="カスタムウィンドウ"
            width={400}
            height={300}
            onClose={() => console.log('ウィンドウが閉じられました')}
        >
            <Container flexDirection="column" gap={12} padding={10}>
                <Text fontSize={16} fontWeight="bold">カスタムコンテンツ</Text>
                <Container flexDirection="column" gap={4}>
                    <Text fontSize={14}>• 項目 1</Text>
                    <Text fontSize={14}>• 項目 2</Text>
                    <Text fontSize={14}>• 項目 3</Text>
                </Container>
                <Container>
                    <Text fontSize={12}
                        onClick={() => alert('ボタンがクリックされました')}
                        cursor="pointer"
                        padding={8}
                        backgroundColor="#007bff"
                        color="white"
                        borderRadius={4}>
                        アクション実行
                    </Text>
                </Container>
            </Container>
        </WindowBox>
    )
}

// オーバーレイウィンドウの例
export function OverlayWindowExample() {
    return (
        <WindowBox
            title="オーバーレイウィンドウ"
            width={350}
            height={250}
            overlay={true}
            distance={1.5}
            followCamera={true}
            onClose={() => console.log('オーバーレイウィンドウが閉じられました')}
        >
            <Container flexDirection="column" gap={8} padding={15}>
                <Text fontSize={16} fontWeight="bold">ユーザーの目の前に表示</Text>
                <Text fontSize={14}>このウィンドウはカメラを追従し、常にユーザーの目の前に表示されます。</Text>
                <Text fontSize={14}>距離: 1.5m</Text>
                <Text fontSize={14}>追従: 有効</Text>
            </Container>
        </WindowBox>
    )
}

// 固定位置オーバーレイの例
export function FixedOverlayExample() {
    return (
        <WindowBox
            title="固定オーバーレイ"
            width={300}
            height={200}
            overlay={true}
            distance={2}
            followCamera={false}
            onClose={() => console.log('固定オーバーレイが閉じられました')}
        >
            <Container flexDirection="column" gap={8} padding={10}>
                <Text fontSize={16} fontWeight="bold">固定位置ウィンドウ</Text>
                <Text fontSize={14}>カメラを追従しない固定位置のオーバーレイです。</Text>
            </Container>
        </WindowBox>
    )
}

// MRシーンでの使用例
export function MRWindowScene() {
    return (
        <Canvas style={{ width: '100vw', height: '100vh' }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />

            {/* 3D空間にWindow画面を配置 */}
            <group position={[0, 0, -2]}>
                <WindowBoxExample />
            </group>

            {/* 別の位置にチャットウィンドウを配置 */}
            <group position={[-2, 1, -1]}>
                <ChatWindow />
            </group>

            {/* 設定ウィンドウを右側に配置 */}
            <group position={[2, 0, -1]}>
                <SettingsWindow />
            </group>

            {/* オーバーレイウィンドウ（ユーザーの目の前に追従表示） */}
            <OverlayWindowExample />

            {/* 固定位置オーバーレイ */}
            <FixedOverlayExample />
        </Canvas>
    )
}

// オーバーレイ機能専用のシーン例
export function OverlayScene() {
    return (
        <Canvas style={{ width: '100vw', height: '100vh' }}>
            <ambientLight intensity={0.7} />
            <pointLight position={[5, 5, 5]} />

            {/* カメラ追従チャットウィンドウ */}
            <ChatWindow
                overlay={true}
                distance={1.8}
                followCamera={true}
            />

            {/* 固定位置設定ウィンドウ */}
            <SettingsWindow
                overlay={true}
                distance={2.5}
                followCamera={false}
            />

            {/* システム情報ウィンドウ（近距離表示） */}
            <SystemInfoWindow
                overlay={true}
                distance={1.2}
                followCamera={true}
            />
        </Canvas>
    )
}

export default WindowBoxExample
