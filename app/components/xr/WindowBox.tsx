import React, { useState, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
    Container,
    Text,
    Root
} from '@react-three/uikit'
import {
    Card,
    Button
} from '@react-three/uikit-apfel'
import { Group, Vector3 } from 'three'

export interface WindowBoxProps {
    title?: string
    width?: number
    height?: number
    closable?: boolean
    onClose?: () => void
    children?: React.ReactNode
    overlay?: boolean // オーバーレイとして表示するかのフラグ
    distance?: number // カメラからの距離
    followCamera?: boolean // カメラを追従するか
    verticalOffset?: number // 垂直方向のオフセット（負の値で下に配置）
    [key: string]: any
}

export function WindowBox({
    title = "MRTalk Window",
    width = 400,
    height = 300,
    closable = true,
    onClose,
    children,
    overlay = false,
    distance = 2,
    followCamera = true,
    verticalOffset = 0,
    ...props
}: WindowBoxProps) {
    const [isVisible, setIsVisible] = useState(true)
    const groupRef = useRef<Group>(null)
    const { camera } = useThree()

    const handleClose = () => {
        setIsVisible(false)
        onClose?.()
    }

    // カメラを追従する場合の位置更新
    useFrame(() => {
        if (overlay && followCamera && groupRef.current) {
            // カメラの前方向に配置
            const cameraDirection = camera.getWorldDirection(new Vector3())
            const position = camera.position.clone()
            position.add(cameraDirection.multiplyScalar(distance))

            // 垂直オフセットを適用
            position.y += verticalOffset

            groupRef.current.position.copy(position)

            // カメラの方向を向く
            groupRef.current.lookAt(camera.position)
        }
    })

    if (!isVisible) return null

    const rootElement = (
        <Root>
            <Container
                width={width}
                height={height}
                {...props}
            >
                <Card padding={5} borderRadius={5}>
                    {/* タイトルバー */}
                    <Container
                        flexDirection="row"
                        alignItems="center"
                        justifyContent="space-between"
                        marginBottom={4}
                        paddingBottom={1}
                    >
                        <Text fontSize={1} fontWeight="bold">
                            {title}
                        </Text>
                        {closable && (
                            <Button onClick={handleClose}>
                                <Text fontSize={1}>x</Text>
                            </Button>
                        )}
                    </Container>

                    {/* コンテンツエリア */}
                    <Container>
                        {children || (
                            <Container
                                justifyContent="center"
                                alignItems="center"
                                padding={2}
                            >
                                <Text fontSize={1}>
                                    MRTalk Window Content
                                </Text>
                            </Container>
                        )}
                    </Container>
                </Card>
            </Container>
        </Root>
    )

    // オーバーレイとして表示する場合は3Dグループでラップ
    if (overlay) {
        return (
            <group
                ref={groupRef}
                position={[0, verticalOffset, -distance]}
                renderOrder={1000} // 他のオブジェクトより前面に表示
            >
                {rootElement}
            </group>
        )
    }

    return rootElement
}

// チャットウィンドウのプリセット
export function ChatWindow(props: Omit<WindowBoxProps, 'children'>) {
    return (
        <WindowBox title="Chat" {...props}>
            <Container flexDirection="column" gap={12}>
                {/* チャット履歴エリア */}
                <Card
                    padding={12}
                    backgroundColor="#f8f9fa"
                    borderRadius={0}
                >
                    <Text fontSize={14}>
                        チャット履歴がここに表示されます
                    </Text>
                </Card>

                {/* 入力エリア */}
                <Container flexDirection="row" gap={8} alignItems="center">
                    <Card
                        padding={8}
                        backgroundColor="#ffffff"
                        borderRadius={0}
                    >
                        <Text fontSize={12}>
                            メッセージを入力...
                        </Text>
                    </Card>
                    <Button>
                        <Text fontSize={12}>送信</Text>
                    </Button>
                </Container>
            </Container>
        </WindowBox>
    )
}

// 設定ウィンドウのプリセット
export function SettingsWindow(props: Omit<WindowBoxProps, 'children'>) {
    return (
        <WindowBox title="Settings" width={500} height={400} {...props}>
            <Container flexDirection="column" gap={16}>
                {/* 一般設定 */}
                <Container>
                    <Text fontSize={16} fontWeight="bold" marginBottom={12}>
                        一般設定
                    </Text>
                    <Container flexDirection="column" gap={8}>
                        <Container flexDirection="row" alignItems="center" justifyContent="space-between">
                            <Text fontSize={14}>
                                音声認識
                            </Text>
                            <Button>
                                <Text fontSize={12}>オン</Text>
                            </Button>
                        </Container>
                        <Container flexDirection="row" alignItems="center" justifyContent="space-between">
                            <Text fontSize={14}>
                                自動応答
                            </Text>
                            <Button>
                                <Text fontSize={12}>オフ</Text>
                            </Button>
                        </Container>
                    </Container>
                </Container>

                {/* 外観設定 */}
                <Container>
                    <Text fontSize={16} fontWeight="bold" marginBottom={12}>
                        外観設定
                    </Text>
                    <Container flexDirection="column" gap={8}>
                        <Container flexDirection="row" alignItems="center" justifyContent="space-between">
                            <Text fontSize={14}>
                                テーマ
                            </Text>
                            <Button>
                                <Text fontSize={12}>ライト</Text>
                            </Button>
                        </Container>
                        <Container flexDirection="row" alignItems="center" justifyContent="space-between">
                            <Text fontSize={14}>
                                フォントサイズ
                            </Text>
                            <Button>
                                <Text fontSize={12}>中</Text>
                            </Button>
                        </Container>
                    </Container>
                </Container>
            </Container>
        </WindowBox>
    )
}

// システム情報ウィンドウ
export function SystemInfoWindow(props: Omit<WindowBoxProps, 'children'>) {
    return (
        <WindowBox title="System Info" width={450} height={350} {...props}>
            <Container flexDirection="column" gap={12}>
                <Card padding={12} backgroundColor="#f0f7ff" borderRadius={0}>
                    <Text fontSize={14} fontWeight="bold" marginBottom={8}>
                        MRTalk システム情報
                    </Text>
                    <Container flexDirection="column" gap={4}>
                        <Text fontSize={12}>Version: 1.0.0</Text>
                        <Text fontSize={12}>Runtime: React Three Fiber</Text>
                        <Text fontSize={12}>UI Kit: @react-three/uikit-apfel</Text>
                    </Container>
                </Card>

                <Card padding={12} backgroundColor="#fff3e0" borderRadius={0}>
                    <Text fontSize={14} fontWeight="bold" marginBottom={8}>
                        パフォーマンス
                    </Text>
                    <Container flexDirection="column" gap={4}>
                        <Text fontSize={12}>FPS: 60</Text>
                        <Text fontSize={12}>メモリ使用量: 156MB</Text>
                        <Text fontSize={12}>レンダリング: WebGL 2.0</Text>
                    </Container>
                </Card>
            </Container>
        </WindowBox>
    )
}

// 使用例コンポーネント
export function WindowBoxExample() {
    const [showChat, setShowChat] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [showInfo, setShowInfo] = useState(false)

    return (
        <Root>
            <Container flexDirection="column" gap={16} padding={20}>
                {/* ウィンドウ表示ボタン */}
                <Container flexDirection="row" gap={12}>
                    <Button onClick={() => setShowChat(true)}>
                        <Text fontSize={12}>チャットを開く</Text>
                    </Button>
                    <Button onClick={() => setShowSettings(true)}>
                        <Text fontSize={12}>設定を開く</Text>
                    </Button>
                    <Button onClick={() => setShowInfo(true)}>
                        <Text fontSize={12}>システム情報</Text>
                    </Button>
                </Container>

                {/* ウィンドウ群 */}
                {showChat && (
                    <ChatWindow
                        onClose={() => setShowChat(false)}
                    />
                )}

                {showSettings && (
                    <SettingsWindow
                        onClose={() => setShowSettings(false)}
                    />
                )}

                {showInfo && (
                    <SystemInfoWindow
                        onClose={() => setShowInfo(false)}
                    />
                )}
            </Container>
        </Root>
    )
}

export default WindowBox