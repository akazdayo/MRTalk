import React, { useState, useRef, useCallback } from 'react';
import { Vector3, Euler, Raycaster, Object3D } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Plane, Sphere, RoundedBox } from '@react-three/drei';
import { Container, Root, Text as UIText } from '@react-three/uikit';
import { MenuState, MenuItemData } from '~/lib/xr/hands/types/HandTypes';

interface MenuControllerProps {
    menuState: MenuState;
    onItemSelect: (itemId: string) => void;
    onMenuToggle: () => void;
    onMenuItemHover?: (itemId: string | null) => void;
    onDragStart?: (itemId: string, position: Vector3) => void;
    onDragEnd?: (itemId: string, position: Vector3) => void;
}

interface MenuPanelData {
    id: string;
    title: string;
    items: MenuItemData[];
    position: Vector3;
    isExpanded: boolean;
    isDraggable: boolean;
}

/**
 * Phase 2: 拡張されたWebXRメニューコントローラー
 * - 複数のメニューパネル管理
 * - 階層構造メニュー
 * - ドラッグ&ドロップ対応
 * - 視覚的フィードバック向上
 * - レイキャスティング精度向上
 */
export default function MenuController({
    menuState,
    onItemSelect,
    onMenuToggle,
    onMenuItemHover,
    onDragStart,
    onDragEnd
}: MenuControllerProps) {
    const { camera, scene } = useThree();
    const raycaster = useRef(new Raycaster());
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const [draggedItem, setDraggedItem] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState<Vector3>(new Vector3());

    // 複数メニューパネルの定義
    const [menuPanels, setMenuPanels] = useState<MenuPanelData[]>([
        {
            id: 'main_panel',
            title: 'メインメニュー',
            isExpanded: true,
            isDraggable: false,
            position: new Vector3(0, 0, 0),
            items: [
                {
                    id: 'character_info',
                    label: 'キャラクター情報',
                    icon: '👤',
                    action: 'show_character_info',
                    position: new Vector3(-0.4, 0.3, 0),
                    isEnabled: true,
                    isSelected: menuState.selectedItem === 'character_info'
                },
                {
                    id: 'favorite_toggle',
                    label: 'お気に入り',
                    icon: '⭐',
                    action: 'toggle_favorite',
                    position: new Vector3(0.4, 0.3, 0),
                    isEnabled: true,
                    isSelected: menuState.selectedItem === 'favorite_toggle'
                },
                {
                    id: 'voice_settings',
                    label: '音声設定',
                    icon: '🔊',
                    action: 'voice_settings',
                    position: new Vector3(-0.4, 0, 0),
                    isEnabled: true,
                    isSelected: menuState.selectedItem === 'voice_settings'
                },
                {
                    id: 'animation_control',
                    label: 'アニメーション',
                    icon: '🎭',
                    action: 'animation_control',
                    position: new Vector3(0.4, 0, 0),
                    isEnabled: true,
                    isSelected: menuState.selectedItem === 'animation_control'
                }
            ]
        },
        {
            id: 'quick_actions',
            title: 'クイックアクション',
            isExpanded: false,
            isDraggable: true,
            position: new Vector3(1.2, 0, 0),
            items: [
                {
                    id: 'take_screenshot',
                    label: 'スクリーンショット',
                    icon: '📸',
                    action: 'take_screenshot',
                    position: new Vector3(0, 0.15, 0),
                    isEnabled: true,
                    isSelected: false
                },
                {
                    id: 'reset_position',
                    label: 'ポジションリセット',
                    icon: '🔄',
                    action: 'reset_position',
                    position: new Vector3(0, -0.15, 0),
                    isEnabled: true,
                    isSelected: false
                }
            ]
        }
    ]);

    // メニューアイテムの統合リスト（後方互換性）
    const allMenuItems: MenuItemData[] = menuPanels.flatMap(panel => panel.items);

    // レイキャスティングによる高精度な選択検出
    const performRaycast = useCallback((handPosition: Vector3, direction: Vector3): MenuItemData | null => {
        raycaster.current.set(handPosition, direction);

        // 全メニューアイテムとの交差判定
        const intersectableObjects: Object3D[] = [];

        scene.traverse((child) => {
            if (child.userData.menuItemId) {
                intersectableObjects.push(child);
            }
        });

        const intersects = raycaster.current.intersectObjects(intersectableObjects, false);

        if (intersects.length > 0) {
            const menuItemId = intersects[0].object.userData.menuItemId;
            return allMenuItems.find(item => item.id === menuItemId) || null;
        }

        return null;
    }, [scene, allMenuItems]);

    // メニューアイテムのクリック処理
    const handleItemClick = useCallback((itemId: string) => {
        onItemSelect?.(itemId);

        // 特別なアクション処理
        switch (itemId) {
            case 'close_menu':
                onMenuToggle();
                break;
            case 'expand_panel':
                togglePanelExpansion(itemId);
                break;
        }
    }, [onItemSelect, onMenuToggle]);

    // ホバー処理
    const handleItemHover = useCallback((itemId: string | null) => {
        setHoveredItem(itemId);
        onMenuItemHover?.(itemId);
    }, [onMenuItemHover]);

    // ドラッグ開始処理
    const handleDragStart = useCallback((itemId: string, startPosition: Vector3) => {
        setDraggedItem(itemId);
        setDragOffset(startPosition);
        onDragStart?.(itemId, startPosition);
    }, [onDragStart]);

    // ドラッグ終了処理
    const handleDragEnd = useCallback((itemId: string, endPosition: Vector3) => {
        setDraggedItem(null);
        setDragOffset(new Vector3());
        onDragEnd?.(itemId, endPosition);
    }, [onDragEnd]);

    // パネル展開/折りたたみ
    const togglePanelExpansion = useCallback((panelId: string) => {
        setMenuPanels(prev => prev.map(panel =>
            panel.id === panelId
                ? { ...panel, isExpanded: !panel.isExpanded }
                : panel
        ));
    }, []);

    // 高度なメニューアイテムレンダリング
    const renderMenuItem = useCallback((item: MenuItemData, panelId: string) => {
        const buttonSize = 0.12;
        const isSelected = item.isSelected;
        const isEnabled = item.isEnabled;
        const isHovered = hoveredItem === item.id;
        const isDragged = draggedItem === item.id;

        const buttonColor = isSelected ? "#ffd700" : isHovered ? "#4299e1" : isEnabled ? "#4a5568" : "#2d3748";
        const scale = isDragged ? 1.1 : isHovered ? 1.05 : 1.0;

        return (
            <group
                key={item.id}
                position={item.position}
                scale={[scale, scale, scale]}
            >
                {/* 進化したボタン背景 */}
                <RoundedBox
                    args={[buttonSize * 2, buttonSize * 2, buttonSize * 0.3]}
                    radius={0.02}
                    smoothness={4}
                    onClick={() => handleItemClick(item.id)}
                    onPointerEnter={() => handleItemHover(item.id)}
                    onPointerLeave={() => handleItemHover(null)}
                    userData={{ menuItemId: item.id }}
                >
                    <meshStandardMaterial
                        color={buttonColor}
                        transparent
                        opacity={isEnabled ? 0.9 : 0.5}
                        roughness={0.3}
                        metalness={0.1}
                    />
                </RoundedBox>

                {/* アクティブ状態のグロー効果 */}
                {(isSelected || isHovered) && (
                    <RoundedBox
                        args={[buttonSize * 2.2, buttonSize * 2.2, buttonSize * 0.1]}
                        radius={0.03}
                        smoothness={4}
                    >
                        <meshBasicMaterial
                            color={isSelected ? "#ffd700" : "#4299e1"}
                            transparent
                            opacity={0.3}
                        />
                    </RoundedBox>
                )}

                {/* アイコン表示 */}
                <Text
                    position={[0, 0.03, buttonSize + 0.01]}
                    fontSize={0.06}
                    color={isSelected ? "#000000" : "#ffffff"}
                    anchorX="center"
                    anchorY="middle"
                >
                    {item.icon}
                </Text>

                {/* ラベル表示 */}
                <Text
                    position={[0, -0.03, buttonSize + 0.01]}
                    fontSize={0.025}
                    color={isSelected ? "#000000" : "#ffffff"}
                    anchorX="center"
                    anchorY="middle"
                    font="/fonts/keifont/keifont.json"
                    maxWidth={buttonSize * 3}
                >
                    {item.label}
                </Text>

                {/* ドラッグ可能なアイテムのインジケーター */}
                {panelId === 'quick_actions' && (
                    <group position={[buttonSize * 0.7, buttonSize * 0.7, buttonSize + 0.01]}>
                        <Sphere args={[0.01]}>
                            <meshBasicMaterial color="#a0aec0" transparent opacity={0.6} />
                        </Sphere>
                        <Sphere args={[0.01]} position={[0.02, 0, 0]}>
                            <meshBasicMaterial color="#a0aec0" transparent opacity={0.6} />
                        </Sphere>
                        <Sphere args={[0.01]} position={[0.04, 0, 0]}>
                            <meshBasicMaterial color="#a0aec0" transparent opacity={0.6} />
                        </Sphere>
                    </group>
                )}

                {/* 拡張されたコライダー */}
                <RoundedBox
                    args={[buttonSize * 2.5, buttonSize * 2.5, buttonSize * 0.5]}
                    radius={0.02}
                    visible={false}
                    onClick={() => handleItemClick(item.id)}
                    onPointerEnter={() => handleItemHover(item.id)}
                    onPointerLeave={() => handleItemHover(null)}
                    userData={{ menuItemId: item.id }}
                />
            </group>
        );
    }, [hoveredItem, draggedItem, handleItemClick, handleItemHover]);

    // メニューパネルのレンダリング
    const renderMenuPanel = useCallback((panel: MenuPanelData) => {
        const panelWidth = panel.isExpanded ? 1.0 : 0.6;
        const panelHeight = panel.isExpanded ? 0.8 : 0.3;

        return (
            <group key={panel.id} position={panel.position}>
                {/* パネル背景 */}
                <RoundedBox
                    args={[panelWidth, panelHeight, 0.03]}
                    radius={0.03}
                    smoothness={4}
                    position={[0, 0, -0.02]}
                >
                    <meshStandardMaterial
                        color="#1a202c"
                        transparent
                        opacity={0.95}
                        roughness={0.2}
                        metalness={0.1}
                    />
                </RoundedBox>

                {/* パネル枠線 */}
                <RoundedBox
                    args={[panelWidth + 0.05, panelHeight + 0.05, 0.01]}
                    radius={0.04}
                    smoothness={4}
                    position={[0, 0, -0.03]}
                >
                    <meshBasicMaterial
                        color="#4a5568"
                        transparent
                        opacity={0.8}
                    />
                </RoundedBox>

                {/* パネルタイトル */}
                <Text
                    position={[0, panelHeight / 2 - 0.08, 0.02]}
                    fontSize={0.04}
                    color="#ffffff"
                    anchorX="center"
                    anchorY="middle"
                    font="/fonts/keifont/keifont.json"
                >
                    {panel.title}
                </Text>

                {/* 展開/折りたたみボタン */}
                <group
                    position={[panelWidth / 2 - 0.1, panelHeight / 2 - 0.08, 0.02]}
                    onClick={() => togglePanelExpansion(panel.id)}
                >
                    <RoundedBox args={[0.06, 0.06, 0.01]} radius={0.01}>
                        <meshBasicMaterial color="#4299e1" transparent opacity={0.8} />
                    </RoundedBox>
                    <Text
                        position={[0, 0, 0.01]}
                        fontSize={0.03}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                    >
                        {panel.isExpanded ? "−" : "+"}
                    </Text>
                </group>

                {/* メニューアイテム（展開時のみ） */}
                {panel.isExpanded && (
                    <group position={[0, -0.1, 0]}>
                        {panel.items.map(item => renderMenuItem(item, panel.id))}
                    </group>
                )}
            </group>
        );
    }, [renderMenuItem, togglePanelExpansion]);

    /**
     * メニューヘッダーのレンダリング
     */
    const renderMenuHeader = () => {
        return (
            <group position={[0, 0.5, 0]}>
                {/* ヘッダー背景 */}
                <Plane args={[1.2, 0.2]} position={[0, 0, -0.01]}>
                    <meshBasicMaterial
                        color="#2d3748"
                        transparent
                        opacity={0.9}
                        toneMapped={false}
                    />
                </Plane>

                {/* タイトル */}
                <Text
                    position={[0, 0, 0.01]}
                    fontSize={0.06}
                    color="#ffffff"
                    anchorX="center"
                    anchorY="middle"
                    font="/fonts/keifont/keifont.json"
                >
                    メニュー
                </Text>
            </group>
        );
    };

    /**
     * ポインター視覚化（ハンドトラッキング用）
     */
    const renderHandPointer = () => {
        // 実際の実装では、ハンドトラッキングデータから位置を取得
        // ここでは例として固定位置に表示
        return (
            <group position={[0, 0, 0.3]} visible={false}>
                {/* ポインター本体 */}
                <Sphere args={[0.01]}>
                    <meshBasicMaterial
                        color="#00ff00"
                        transparent
                        opacity={0.8}
                    />
                </Sphere>

                {/* ポインターのレイ */}
                <mesh>
                    <cylinderGeometry args={[0.002, 0.002, 0.3, 8]} />
                    <meshBasicMaterial
                        color="#00ff00"
                        transparent
                        opacity={0.5}
                    />
                </mesh>
            </group>
        );
    };

    /**
     * メニューの枠線とコンテナ
     */
    const renderMenuContainer = () => {
        const containerWidth = 1.4;
        const containerHeight = 1.0;

        return (
            <group>
                {/* メイン背景 */}
                <Plane args={[containerWidth, containerHeight]} position={[0, 0, -0.02]}>
                    <meshBasicMaterial
                        color="#1a202c"
                        transparent
                        opacity={0.9}
                        toneMapped={false}
                    />
                </Plane>

                {/* 枠線 */}
                <Plane args={[containerWidth + 0.05, containerHeight + 0.05]} position={[0, 0, -0.03]}>
                    <meshBasicMaterial
                        color="#4a5568"
                        transparent
                        opacity={0.8}
                        toneMapped={false}
                    />
                </Plane>
            </group>
        );
    };

    // ハンドポインターの視覚化（強化版）
    const renderAdvancedHandPointer = useCallback(() => {
        if (!hoveredItem) return null;

        return (
            <group position={[0, 0, 0.2]}>
                {/* メインポインター */}
                <Sphere args={[0.008]}>
                    <meshBasicMaterial
                        color="#00ff88"
                        transparent
                        opacity={0.9}
                    />
                </Sphere>

                {/* ポインターレイ */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.001, 0.002, 0.3, 8]} />
                    <meshBasicMaterial
                        color="#00ff88"
                        transparent
                        opacity={0.6}
                    />
                </mesh>

                {/* 交差点のマーカー */}
                <Sphere args={[0.015]} position={[0, 0, -0.15]}>
                    <meshBasicMaterial
                        color="#ffffff"
                        transparent
                        opacity={0.4}
                    />
                </Sphere>
            </group>
        );
    }, [hoveredItem]);

    if (!menuState.isVisible) {
        return null;
    }

    return (
        <group position={[0, -0.3, 0]}>
            {/* 複数メニューパネルのレンダリング */}
            {menuPanels.map(panel => renderMenuPanel(panel))}

            {/* 高度なハンドポインター */}
            {renderAdvancedHandPointer()}

            {/* UIKit統合のインフォメーション */}
            <group position={[0, -0.7, 0]}>
                <Root
                    sizeX={1.5}
                    sizeY={0.3}
                    pixelSize={0.001}
                    anchorX="center"
                    anchorY="center"
                >
                    <Container
                        justifyContent="center"
                        alignItems="center"
                        backgroundColor="#1a202c"
                        borderRadius={8}
                        padding={12}
                        width="100%"
                        height="100%"
                    >
                        <UIText fontSize={12} color="#a0aec0">
                            🤘 Rock'n rollジェスチャーでメニュー切り替え | 👉 Point&Tapで選択
                        </UIText>
                    </Container>
                </Root>
            </group>

            {/* 閉じるボタン（固定位置） */}
            <group position={[0.8, 0.6, 0]}>
                <RoundedBox
                    args={[0.12, 0.12, 0.03]}
                    radius={0.02}
                    onClick={onMenuToggle}
                >
                    <meshStandardMaterial
                        color="#e53e3e"
                        transparent
                        opacity={0.9}
                    />
                </RoundedBox>
                <Text
                    position={[0, 0, 0.02]}
                    fontSize={0.05}
                    color="#ffffff"
                    anchorX="center"
                    anchorY="middle"
                >
                    ✕
                </Text>
            </group>
        </group>
    );
}