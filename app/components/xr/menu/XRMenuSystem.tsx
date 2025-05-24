import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { Vector3, Euler } from 'three';
import { Text } from '@react-three/drei';
import { HandTrackingManager } from '~/lib/xr/hands/HandTrackingManager';
import { GestureRecognizer } from '~/lib/xr/hands/GestureRecognizer';
import {
    GestureType,
    GestureResult,
    MenuState,
    MenuConfiguration,
    HandTrackingErrorInfo
} from '~/lib/xr/hands/types/HandTypes';
import CharacterInfoPanel from './CharacterInfoPanel';
import MenuController from './MenuController';
import {
    useXRPerformance,
    useDebounce,
    useXRSystemHealth,
    useVRMPerformance
} from '~/lib/xr/hooks/useXRPerformance';
import { getVRMMenuIntegration, VRMData } from '~/lib/xr/vrm/VRMMenuIntegration';
import { getMemoryManager } from '~/lib/xr/core/MemoryManager';
import { getErrorHandler } from '~/lib/xr/core/ErrorHandler';

interface Character {
    id: string;
    name: string;
    personality?: string;
    story?: string;
    isFavorite?: boolean;
}

interface XRMenuSystemProps {
    character: Character;
    onCharacterUpdate?: (character: Character) => void;
    vrmPath?: string;
    enableVRMPreview?: boolean;
    onVRMLoad?: (vrmData: VRMData) => void;
    onVRMError?: (error: Error) => void;
}

/**
 * WebXRメニューシステムのメインコンポーネント
 * ハンドトラッキングとジェスチャー認識を統合
 */
export default function XRMenuSystem({
    character,
    onCharacterUpdate,
    vrmPath,
    enableVRMPreview = true,
    onVRMLoad,
    onVRMError
}: XRMenuSystemProps) {
    const { session } = useXR();
    const { camera } = useThree();

    // Phase 4: VRM統合システムとパフォーマンス監視
    const vrmIntegration = getVRMMenuIntegration();
    const memoryManager = getMemoryManager();
    const errorHandler = getErrorHandler();
    const { vrmMetrics, optimizeVRMSettings } = useVRMPerformance();

    // ハンドトラッキング管理
    const handTrackingManagerRef = useRef<HandTrackingManager | null>(null);
    const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);

    // Phase 4: VRM関連状態
    const [vrmData, setVrmData] = useState<VRMData | null>(null);
    const [vrmLoadError, setVrmLoadError] = useState<Error | null>(null);
    const [isVrmLoaded, setIsVrmLoaded] = useState(false);

    // メニュー状態（拡張版）
    const [menuState, setMenuState] = useState<MenuState>({
        isVisible: false,
        selectedItem: null,
        position: new Vector3(0, 1.5, -1),
        rotation: new Euler(0, 0, 0),
        items: [],
        lastUpdateTime: Date.now()
    });

    // エラー状態
    const [error, setError] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // キャラクター情報パネル状態
    const [showCharacterInfo, setShowCharacterInfo] = useState(false);
    const [showDetailsPanel, setShowDetailsPanel] = useState(false);

    // ドラッグ＆ドロップ状態
    const [dragState, setDragState] = useState({
        isDragging: false,
        draggedItem: null as string | null,
        dragStartPosition: new Vector3()
    });

    // ユーザーの手の位置追従状態
    const [handPosition, setHandPosition] = useState<Vector3>(new Vector3());
    const [isHandTracked, setIsHandTracked] = useState(false);

    // Phase 2: パフォーマンス最適化の統合
    const {
        metrics,
        performanceLevel,
        optimizedSettings,
        shouldTriggerGC
    } = useXRPerformance({
        targetFps: 60,
        maxLODDistance: 15,
        cullDistance: 30
    });

    const { systemHealth, measureHandTrackingLatency, measureMenuResponseTime } = useXRSystemHealth();

    // デバウンスされたメニュー位置（不要な更新を防止）
    const debouncedMenuPosition = useDebounce(menuState.position, 100);

    // メニュー設定
    const menuConfig: MenuConfiguration = {
        defaultPosition: new Vector3(0, 1.5, -1),
        fixedDistance: 1.0,
        autoRotate: true,
        fadeInDuration: 300,
        fadeOutDuration: 200
    };

    /**
     * XRセッション開始時の初期化
     */
    useEffect(() => {
        if (session && !isInitialized) {
            initializeHandTracking();
        }

        return () => {
            cleanup();
        };
    }, [session, isInitialized]);

    /**
     * Phase 4: VRMロード処理
     */
    useEffect(() => {
        const loadVRM = async () => {
            if (!vrmPath || !character.id) return;

            try {
                setVrmLoadError(null);
                setIsVrmLoaded(false);

                console.log(`XRMenuSystem: Loading VRM for character ${character.id}`);

                const loadedVRM = await vrmIntegration.loadCharacter(
                    character.id,
                    vrmPath,
                    character
                );

                if (loadedVRM) {
                    setVrmData(loadedVRM);
                    setIsVrmLoaded(true);
                    onVRMLoad?.(loadedVRM);

                    // VRMメニュー連動イベントの設定
                    vrmIntegration.registerMenuInteractionCallback(character.id, (vrmCharacter) => {
                        console.log('VRM character interaction:', vrmCharacter);
                    });

                    console.log(`XRMenuSystem: VRM loaded successfully for ${character.name}`);
                } else {
                    throw new Error('VRM loading returned null');
                }
            } catch (error) {
                console.error('XRMenuSystem: VRM loading failed:', error);
                const vrmError = error instanceof Error ? error : new Error('Unknown VRM loading error');
                setVrmLoadError(vrmError);
                onVRMError?.(vrmError);

                // エラーハンドラーでフォールバック処理
                await errorHandler.handleVRMLoadFailure(character.id, vrmPath, vrmError);
            }
        };

        loadVRM();
    }, [character.id, vrmPath, enableVRMPreview]);

    /**
     * Phase 4: VRMパフォーマンス最適化
     */
    useEffect(() => {
        if (vrmData && metrics.fps < 45) {
            console.log('XRMenuSystem: Optimizing VRM settings due to low FPS');
            optimizeVRMSettings(metrics.fps);
        }
    }, [vrmData, metrics.fps]);

    /**
     * ハンドトラッキングシステムの初期化
     */
    const initializeHandTracking = async () => {
        try {
            // エラーハンドリングコールバック
            const errorCallback = (errorInfo: HandTrackingErrorInfo) => {
                console.error('Hand tracking error:', errorInfo);
                setError(`ハンドトラッキングエラー: ${errorInfo.message}`);
            };

            // HandTrackingManagerの初期化
            const handTrackingManager = new HandTrackingManager(errorCallback);
            const initialized = await handTrackingManager.initialize(session!);

            if (!initialized) {
                setError('ハンドトラッキングの初期化に失敗しました');
                return;
            }

            // GestureRecognizerの初期化
            const gestureRecognizer = new GestureRecognizer();

            // ジェスチャーコールバックの設定
            gestureRecognizer.addGestureCallback((gesture: GestureResult) => {
                handleGestureDetected(gesture);
            });

            handTrackingManagerRef.current = handTrackingManager;
            gestureRecognizerRef.current = gestureRecognizer;

            setIsInitialized(true);
            setError(null);

            console.log('XRMenuSystem initialized successfully');
        } catch (error) {
            console.error('Failed to initialize XRMenuSystem:', error);
            setError('メニューシステムの初期化に失敗しました');
        }
    };

    /**
     * Phase 2: パフォーマンス最適化されたジェスチャー検出処理
     */
    const handleGestureDetected = (gesture: GestureResult) => {
        const endLatencyMeasurement = measureHandTrackingLatency();

        try {
            switch (gesture.type) {
                case GestureType.ROCK_AND_ROLL:
                    const endMenuResponse = measureMenuResponseTime();
                    toggleMenuVisibility();
                    endMenuResponse();
                    break;

                case GestureType.POINTING:
                    // ポイント位置でのアイテム選択処理
                    if (gesture.position && gesture.direction) {
                        handlePointing(gesture.position, gesture.direction);
                    }
                    break;

                case GestureType.TAPPING:
                    // タップ処理
                    if (menuState.selectedItem) {
                        handleMenuItemSelection(menuState.selectedItem);
                    }
                    break;
            }
        } finally {
            endLatencyMeasurement();
        }
    };

    /**
     * メニューの表示/非表示を切り替え
     */
    const toggleMenuVisibility = () => {
        setMenuState(prev => {
            const newState = {
                ...prev,
                isVisible: !prev.isVisible,
                lastUpdateTime: Date.now()
            };

            // メニューが表示される場合、カメラ位置に基づいて配置を更新
            if (newState.isVisible) {
                updateMenuPosition(newState);
            }

            return newState;
        });
    };

    /**
     * ポイント操作の処理
     */
    const handlePointing = (position: Vector3, direction: Vector3) => {
        // レイキャスティングによるメニューアイテムの検出
        // 実装では3D空間内のメニューアイテムとの交差判定を行う
        console.log('Pointing detected at:', position, 'direction:', direction);
    };

    /**
     * メニューアイテム選択の処理
     */
    /**
     * Phase 2: 拡張されたメニューアイテム選択処理
     */
    const handleMenuItemSelection = (itemId: string) => {
        console.log('Menu item selected:', itemId);

        switch (itemId) {
            case 'character_info':
                setShowCharacterInfo(!showCharacterInfo);
                break;

            case 'favorite_toggle':
                handleFavoriteToggle();
                break;

            case 'voice_settings':
                handleVoiceSettings();
                break;

            case 'animation_control':
                handleAnimationControl();
                break;

            case 'take_screenshot':
                handleScreenshot();
                break;

            case 'reset_position':
                handleResetPosition();
                break;

            case 'close_menu':
                setMenuState(prev => ({ ...prev, isVisible: false }));
                setShowCharacterInfo(false);
                break;
        }
    };

    /**
     * お気に入り状態の切り替え
     */
    const handleFavoriteToggle = () => {
        const updatedCharacter = {
            ...character,
            isFavorite: !character.isFavorite
        };
        onCharacterUpdate?.(updatedCharacter);
    };

    /**
     * 音声設定の処理
     */
    const handleVoiceSettings = () => {
        console.log('Voice settings requested');
        // 音声設定パネルの表示など
    };

    /**
     * アニメーション制御の処理
     */
    const handleAnimationControl = () => {
        console.log('Animation control requested');
        // アニメーション制御パネルの表示など
    };

    /**
     * スクリーンショット撮影
     */
    const handleScreenshot = () => {
        console.log('Screenshot requested');
        // スクリーンショット機能の実装
    };

    /**
     * ポジションリセット
     */
    const handleResetPosition = () => {
        console.log('Position reset requested');
        // VRMキャラクターの位置リセット
    };

    /**
     * メニューアイテムホバー処理
     */
    const handleMenuItemHover = (itemId: string | null) => {
        setMenuState(prev => ({
            ...prev,
            selectedItem: itemId
        }));
    };

    /**
     * ドラッグ開始処理
     */
    const handleDragStart = (itemId: string, position: Vector3) => {
        setDragState({
            isDragging: true,
            draggedItem: itemId,
            dragStartPosition: position.clone()
        });
    };

    /**
     * ドラッグ終了処理
     */
    const handleDragEnd = (itemId: string, position: Vector3) => {
        setDragState({
            isDragging: false,
            draggedItem: null,
            dragStartPosition: new Vector3()
        });
    };

    /**
     * キャラクター情報パネルの閉じる処理
     */
    const handleCharacterInfoClose = () => {
        setShowCharacterInfo(false);
    };

    /**
     * 詳細パネル表示切り替え
     */
    const handleShowDetails = () => {
        setShowDetailsPanel(!showDetailsPanel);
    };

    /**
     * メニュー位置の更新
     */
    const updateMenuPosition = (state: MenuState) => {
        if (!menuConfig.autoRotate) return state;

        // カメラの前方に配置
        const cameraPosition = camera.position.clone();
        const cameraDirection = new Vector3(0, 0, -1);
        cameraDirection.applyQuaternion(camera.quaternion);

        const menuPosition = cameraPosition
            .clone()
            .add(cameraDirection.multiplyScalar(menuConfig.fixedDistance));

        // ユーザーの方を向くように回転を計算
        const lookAtRotation = new Euler();
        const lookAtMatrix = camera.matrix.clone().lookAt(
            menuPosition,
            cameraPosition,
            new Vector3(0, 1, 0)
        );
        lookAtRotation.setFromRotationMatrix(lookAtMatrix);

        state.position = menuPosition;
        state.rotation = lookAtRotation;

        return state;
    };

    /**
     * フレーム毎の更新処理
     */
    /**
     * Phase 2: パフォーマンス最適化されたフレーム毎の更新処理
     */
    useFrame((state, delta) => {
        if (!handTrackingManagerRef.current || !gestureRecognizerRef.current) return;

        // パフォーマンスレベルに応じた更新頻度調整
        const shouldSkipFrame = performanceLevel === 'low' && frameCountRef.current % 2 !== 0;
        frameCountRef.current++;

        if (shouldSkipFrame) return;

        // ハンドトラッキングデータを取得
        const handData = handTrackingManagerRef.current.getHandTrackingData();

        if (handData.isTracking) {
            setIsHandTracked(true);

            // 右手の位置を追跡（メニュー位置の動的調整用）
            if (handData.right && handData.right.joints) {
                // jointsから最初に利用可能な関節の位置を取得
                for (const [, jointData] of handData.right.joints.entries()) {
                    if (jointData && jointData.position) {
                        setHandPosition(jointData.position.clone());
                        break; // 最初に見つけた有効な関節を使用
                    }
                }
            }

            // ジェスチャー認識を実行（パフォーマンス調整）
            if (performanceLevel !== 'low' || frameCountRef.current % 3 === 0) {
                gestureRecognizerRef.current.recognizeGesture(
                    handData.left,
                    handData.right
                );
            }
        } else {
            setIsHandTracked(false);
        }

        // メニューが表示中の場合、位置を更新（デバウンス適用）
        if (menuState.isVisible && menuConfig.autoRotate) {
            // パフォーマンスが低い場合は更新頻度を下げる
            const shouldUpdatePosition = performanceLevel === 'high' || frameCountRef.current % 4 === 0;

            if (shouldUpdatePosition) {
                setMenuState(prev => {
                    const updatedState = updateMenuPosition({ ...prev });

                    // 手の位置に基づいた動的配置（Phase 2の新機能）
                    if (isHandTracked && handPosition.length() > 0 && performanceLevel !== 'low') {
                        const optimalPosition = calculateOptimalMenuPosition(handPosition);
                        updatedState.position = optimalPosition;
                    }

                    return updatedState;
                });
            }
        }

        // ガベージコレクション推奨時の警告
        if (shouldTriggerGC()) {
            console.warn('High memory usage detected, consider reducing UI complexity');
        }
    });

    // フレームカウンター
    const frameCountRef = useRef(0);

    /**
     * 手の位置に基づく最適なメニュー配置計算（Phase 2の新機能）
     */
    const calculateOptimalMenuPosition = (handPos: Vector3): Vector3 => {
        const cameraPosition = camera.position.clone();
        const handToCamera = handPos.clone().sub(cameraPosition);

        // 手とカメラの中間点からやや手寄りに配置
        const optimalDistance = Math.min(Math.max(handToCamera.length() * 0.7, 0.8), 1.5);
        const direction = handToCamera.normalize();

        return cameraPosition.clone().add(direction.multiplyScalar(optimalDistance));
    };

    /**
     * クリーンアップ処理
     */
    const cleanup = () => {
        if (handTrackingManagerRef.current) {
            handTrackingManagerRef.current.destroy();
            handTrackingManagerRef.current = null;
        }

        if (gestureRecognizerRef.current) {
            gestureRecognizerRef.current.destroy();
            gestureRecognizerRef.current = null;
        }

        setIsInitialized(false);
    };

    // エラー表示
    if (error) {
        return (
            <mesh position={[0, 2, -2]}>
                <planeGeometry args={[2, 0.5]} />
                <meshBasicMaterial color="red" transparent opacity={0.7} />
            </mesh>
        );
    }

    // 初期化中
    if (!isInitialized) {
        return (
            <mesh position={[0, 2, -2]}>
                <planeGeometry args={[2, 0.5]} />
                <meshBasicMaterial color="blue" transparent opacity={0.5} />
            </mesh>
        );
    }

    return (
        <group>
            {/* メインメニューシステム */}
            {menuState.isVisible && (
                <group
                    position={menuState.position}
                    rotation={menuState.rotation}
                >
                    {/* 拡張されたメニューコントローラー */}
                    <MenuController
                        menuState={menuState}
                        onItemSelect={handleMenuItemSelection}
                        onMenuToggle={toggleMenuVisibility}
                        onMenuItemHover={handleMenuItemHover}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    />
                </group>
            )}

            {/* キャラクター情報パネル（独立表示） */}
            {showCharacterInfo && (
                <group
                    position={[
                        menuState.position.x + 1.5,
                        menuState.position.y,
                        menuState.position.z
                    ]}
                    rotation={menuState.rotation}
                >
                    <CharacterInfoPanel
                        character={{
                            ...character,
                            stats: {
                                friendliness: 85,
                                intelligence: 92,
                                creativity: 78,
                                energy: 88
                            }
                        }}
                        position={new Vector3(0, 0, 0)}
                        visible={showCharacterInfo}
                        onFavoriteToggle={handleFavoriteToggle}
                        onClose={handleCharacterInfoClose}
                        onShowDetails={handleShowDetails}
                        vrmPath={vrmPath}
                        onEmotionChange={async (emotion, intensity) => {
                            if (vrmData) {
                                await vrmIntegration.setCharacterEmotion(emotion, intensity);
                            }
                        }}
                        onPoseChange={async (pose) => {
                            if (vrmData?.animationManager) {
                                switch (pose) {
                                    case 'standing':
                                        vrmData.animationManager.playAnimation('idle');
                                        break;
                                    case 'sitting':
                                        vrmData.animationManager.playAnimation('sit_anim');
                                        break;
                                    case 'walking':
                                        vrmData.animationManager.playAnimation('walk');
                                        break;
                                }
                            }
                        }}
                        onAnimationTrigger={async (animation) => {
                            if (vrmData?.animationManager) {
                                vrmData.animationManager.playAnimation(animation);
                            }
                        }}
                    />
                </group>
            )}

            {/* Phase 2: 拡張されたパフォーマンス監視UI */}
            {isInitialized && (
                <group position={[menuState.position.x, menuState.position.y + 1, menuState.position.z]}>
                    {/* ハンドトラッキング状態 */}
                    <mesh>
                        <sphereGeometry args={[0.02]} />
                        <meshBasicMaterial
                            color={isHandTracked ? "#00ff00" : "#ff0000"}
                            transparent
                            opacity={0.6}
                        />
                    </mesh>

                    {/* パフォーマンスレベルインジケーター */}
                    <mesh position={[0.1, 0, 0]}>
                        <sphereGeometry args={[0.015]} />
                        <meshBasicMaterial
                            color={
                                performanceLevel === 'high' ? "#00ff00" :
                                    performanceLevel === 'medium' ? "#ffff00" : "#ff0000"
                            }
                            transparent
                            opacity={0.8}
                        />
                    </mesh>
                </group>
            )}

            {/* デバッグ情報（開発時のみ） */}
            {process.env.NODE_ENV === 'development' && isInitialized && (
                <group position={[menuState.position.x, menuState.position.y - 1, menuState.position.z]}>
                    <Text
                        fontSize={0.025}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                    >
                        {`Hand: ${isHandTracked} | FPS: ${Math.round(metrics.fps)} | Perf: ${performanceLevel} | VRM: ${isVrmLoaded ? 'OK' : 'NO'}`}
                    </Text>
                    <Text
                        position={[0, -0.1, 0]}
                        fontSize={0.02}
                        color="#a0aec0"
                        anchorX="center"
                        anchorY="middle"
                    >
                        {`Hand: ${Math.round(systemHealth.handTrackingLatency)}ms | Menu: ${Math.round(systemHealth.menuResponseTime)}ms | VRM Render: ${Math.round(vrmMetrics.vrmRenderTime)}ms`}
                    </Text>
                    {vrmLoadError && (
                        <Text
                            position={[0, -0.2, 0]}
                            fontSize={0.015}
                            color="#ff0000"
                            anchorX="center"
                            anchorY="middle"
                        >
                            {`VRM Error: ${vrmLoadError.message}`}
                        </Text>
                    )}
                </group>
            )}
        </group>
    );
}