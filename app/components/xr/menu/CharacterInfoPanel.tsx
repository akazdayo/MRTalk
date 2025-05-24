import React, { useState, useRef, useEffect } from 'react';
import { Vector3, Color } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Sphere, RoundedBox } from '@react-three/drei';
import {
    Container,
    Root,
    Image,
    Text as UIText
} from '@react-three/uikit';
import { getVRMMenuIntegration, VRMData } from '~/lib/xr/vrm/VRMMenuIntegration';

interface Character {
    id: string;
    name: string;
    personality?: string;
    story?: string;
    isFavorite?: boolean;
    avatar?: string;
    stats?: {
        friendliness: number;
        intelligence: number;
        creativity: number;
        energy: number;
    };
}

interface CharacterInfoPanelProps {
    character: Character;
    position: Vector3;
    visible: boolean;
    onFavoriteToggle?: () => void;
    onClose?: () => void;
    onShowDetails?: () => void;
    vrmPath?: string;
    onEmotionChange?: (emotion: 'neutral' | 'happy' | 'sad' | 'angry', intensity?: number) => void;
    onPoseChange?: (pose: string) => void;
    onAnimationTrigger?: (animation: string) => void;
}

/**
 * Phase 2: 詳細化されたキャラクター情報パネル
 * - 最新@react-three/uikitの機能を活用
 * - 3Dアバター表示
 * - インタラクティブな要素
 * - アニメーション遷移
 * - 統計情報表示
 */
export default function CharacterInfoPanel({
    character,
    position,
    visible,
    onFavoriteToggle,
    onClose,
    onShowDetails,
    vrmPath,
    onEmotionChange,
    onPoseChange,
    onAnimationTrigger
}: CharacterInfoPanelProps) {
    const { camera } = useThree();
    const panelRef = useRef<any>();
    const [hoveredButton, setHoveredButton] = useState<string | null>(null);
    const [showDetails, setShowDetails] = useState(false);

    // Phase 4: VRM統合機能の状態管理
    const [vrmData, setVrmData] = useState<VRMData | null>(null);
    const [selectedEmotion, setSelectedEmotion] = useState<'neutral' | 'happy' | 'sad' | 'angry'>('neutral');
    const [emotionIntensity, setEmotionIntensity] = useState(1.0);
    const [selectedAnimation, setSelectedAnimation] = useState<string>('idle');
    const [showVRMControls, setShowVRMControls] = useState(false);

    // VRMMenuIntegrationのインスタンス
    const vrmIntegration = getVRMMenuIntegration();

    // パネルサイズとレスポンシブ設定
    const panelWidth = 2.0;
    const panelHeight = 1.6;
    const pixelSize = 0.0008;

    // アニメーション状態
    const [animationState, setAnimationState] = useState({
        scale: visible ? 1 : 0,
        opacity: visible ? 1 : 0,
        rotation: 0
    });

    // Phase 4: VRMデータの初期化
    useEffect(() => {
        const initializeVRM = async () => {
            if (!vrmPath || !character.id) return;

            try {
                const loadedVRM = await vrmIntegration.loadCharacter(
                    character.id,
                    vrmPath,
                    character
                );

                if (loadedVRM) {
                    setVrmData(loadedVRM);
                    console.log(`CharacterInfoPanel: VRM loaded for ${character.name}`);
                }
            } catch (error) {
                console.error('CharacterInfoPanel: Failed to load VRM:', error);
            }
        };

        initializeVRM();
    }, [character.id, vrmPath]);

    // Phase 4: VRM制御関数
    const handleEmotionChange = async (emotion: 'neutral' | 'happy' | 'sad' | 'angry', intensity: number = 1.0) => {
        setSelectedEmotion(emotion);
        setEmotionIntensity(intensity);

        if (vrmData) {
            await vrmIntegration.setCharacterEmotion(emotion, intensity);
            onEmotionChange?.(emotion, intensity);
        }
    };

    const handleAnimationTrigger = (animationName: string) => {
        setSelectedAnimation(animationName);

        if (vrmData?.animationManager) {
            // 現在のアニメーションを停止して新しいアニメーションを再生
            vrmData.animationManager.stopAllAnimation();
            vrmData.animationManager.playAnimation(animationName);
            onAnimationTrigger?.(animationName);
        }
    };

    const handlePoseChange = (pose: string) => {
        onPoseChange?.(pose);
        // ポーズに応じたアニメーション設定
        switch (pose) {
            case 'standing':
                handleAnimationTrigger('idle');
                break;
            case 'sitting':
                handleAnimationTrigger('sit_anim');
                break;
            case 'walking':
                handleAnimationTrigger('walk');
                break;
        }
    };

    // リアルタイムVRMプレビュー用のミニVRMレンダラー
    const renderVRMPreview = () => {
        if (!vrmData) return null;

        return (
            <group position={[0.7, 0.2, 0]} scale={[0.3, 0.3, 0.3]}>
                <primitive object={vrmData.gltf.scene} />
            </group>
        );
    };

    // フレーム毎の更新処理（スムーズなアニメーション）
    useFrame((state, delta) => {
        if (!panelRef.current) return;

        // 表示/非表示アニメーション
        const targetScale = visible ? 1 : 0;
        const targetOpacity = visible ? 1 : 0;

        animationState.scale += (targetScale - animationState.scale) * delta * 8;
        animationState.opacity += (targetOpacity - animationState.opacity) * delta * 6;

        // 視線方向への自動回転（強化版）
        const cameraPosition = camera.position.clone();
        const panelPosition = position.clone();
        const direction = cameraPosition.sub(panelPosition).normalize();

        const targetRotation = Math.atan2(direction.x, direction.z);
        const rotationDiff = targetRotation - animationState.rotation;

        // 角度の正規化
        let normalizedDiff = rotationDiff;
        if (normalizedDiff > Math.PI) normalizedDiff -= 2 * Math.PI;
        if (normalizedDiff < -Math.PI) normalizedDiff += 2 * Math.PI;

        animationState.rotation += normalizedDiff * delta * 4;

        // パネルのスケールと回転を適用
        panelRef.current.scale.setScalar(animationState.scale);
        panelRef.current.rotation.y = animationState.rotation;
        panelRef.current.material.opacity = animationState.opacity;
    });

    if (!visible && animationState.scale < 0.01) return null;

    const handleFavoriteClick = () => {
        onFavoriteToggle?.();
    };

    const handleDetailsToggle = () => {
        setShowDetails(!showDetails);
        onShowDetails?.();
    };

    const handleCloseClick = () => {
        onClose?.();
    };

    // 統計バーのレンダリング
    const renderStatBar = (label: string, value: number, color: string) => (
        <Container
            flexDirection="row"
            alignItems="center"
            gap={12}
            marginBottom={8}
            width="100%"
        >
            <UIText fontSize={14} color="#a0aec0" width={80}>
                {label}
            </UIText>
            <Container
                flexDirection="row"
                alignItems="center"
                flexGrow={1}
                height={6}
                backgroundColor="#2d3748"
                borderRadius={3}
            >
                <Container
                    width={`${value}%`}
                    height="100%"
                    backgroundColor={color}
                    borderRadius={3}
                />
            </Container>
            <UIText fontSize={12} color="#e2e8f0" width={30}>
                {value}%
            </UIText>
        </Container>
    );

    return (
        <group position={position} ref={panelRef}>
            {/* 3D背景パネル */}
            <RoundedBox
                args={[panelWidth, panelHeight, 0.05]}
                radius={0.05}
                smoothness={4}
                position={[0, 0, -0.025]}
            >
                <meshStandardMaterial
                    color="#1a202c"
                    transparent
                    opacity={0.95}
                    roughness={0.1}
                    metalness={0.1}
                />
            </RoundedBox>

            {/* グロー効果 */}
            <RoundedBox
                args={[panelWidth + 0.1, panelHeight + 0.1, 0.02]}
                radius={0.06}
                smoothness={4}
                position={[0, 0, -0.04]}
            >
                <meshBasicMaterial
                    color="#4299e1"
                    transparent
                    opacity={0.2}
                />
            </RoundedBox>

            {/* メインUIコンテナ */}
            <Root
                sizeX={panelWidth}
                sizeY={panelHeight}
                pixelSize={pixelSize}
                anchorX="center"
                anchorY="center"
            >
                <Container
                    flexDirection="column"
                    padding={24}
                    gap={16}
                    width="100%"
                    height="100%"
                    backgroundColor="transparent"
                >
                    {/* ヘッダーセクション */}
                    <Container
                        flexDirection="row"
                        justifyContent="space-between"
                        alignItems="center"
                        paddingBottom={16}
                        borderColor="#4a5568"
                        borderWidth={0}
                        borderBottomWidth={1}
                    >
                        {/* キャラクター名とタイトル */}
                        <Container flexDirection="column" gap={4}>
                            <UIText fontSize={24} fontWeight="bold" color="#ffffff">
                                {character.name}
                            </UIText>
                            <UIText fontSize={14} color="#a0aec0">
                                キャラクター情報
                            </UIText>
                        </Container>

                        {/* お気に入りボタン */}
                        <Container
                            onClick={handleFavoriteClick}
                            backgroundColor={character.isFavorite ? "#ffd700" : "transparent"}
                            borderWidth={2}
                            borderColor={character.isFavorite ? "#ffd700" : "#4a5568"}
                            borderRadius={8}
                            padding={8}
                            justifyContent="center"
                            alignItems="center"
                            width={40}
                            height={40}
                            hover={{
                                backgroundColor: character.isFavorite ? "#ffed4e" : "#4a5568"
                            }}
                        >
                            <UIText
                                fontSize={16}
                                color={character.isFavorite ? "#000000" : "#ffffff"}
                            >
                                {character.isFavorite ? "★" : "☆"}
                            </UIText>
                        </Container>
                    </Container>

                    {/* 3Dアバター表示エリア */}
                    <Container
                        flexDirection="row"
                        gap={16}
                        flexGrow={1}
                    >
                        {/* アバター表示 */}
                        <Container
                            width={120}
                            height={120}
                            backgroundColor="#2d3748"
                            borderRadius={12}
                            justifyContent="center"
                            alignItems="center"
                            borderWidth={2}
                            borderColor="#4a5568"
                        >
                            {character.avatar ? (
                                <Image
                                    src={character.avatar}
                                    width="100%"
                                    height="100%"
                                    borderRadius={10}
                                    objectFit="cover"
                                />
                            ) : vrmData ? (
                                <Container
                                    width="100%"
                                    height="100%"
                                    backgroundColor="#1a202c"
                                    borderRadius={10}
                                    justifyContent="center"
                                    alignItems="center"
                                    borderWidth={1}
                                    borderColor="#4299e1"
                                >
                                    <UIText fontSize={10} color="#4299e1" textAlign="center">
                                        VRM{'\n'}Loaded
                                    </UIText>
                                </Container>
                            ) : (
                                <UIText fontSize={48} color="#a0aec0">
                                    👤
                                </UIText>
                            )}
                        </Container>

                        {/* 詳細情報 */}
                        <Container
                            flexDirection="column"
                            flexGrow={1}
                            gap={12}
                        >
                            {/* 性格情報 */}
                            {character.personality && (
                                <Container flexDirection="column" gap={4}>
                                    <UIText fontSize={16} fontWeight="bold" color="#e2e8f0">
                                        性格
                                    </UIText>
                                    <UIText fontSize={14} color="#a0aec0">
                                        {character.personality}
                                    </UIText>
                                </Container>
                            )}

                            {/* ストーリー情報（切り替え可能） */}
                            {character.story && (
                                <Container flexDirection="column" gap={4}>
                                    <Container
                                        flexDirection="row"
                                        justifyContent="space-between"
                                        alignItems="center"
                                    >
                                        <UIText fontSize={16} fontWeight="bold" color="#e2e8f0">
                                            ストーリー
                                        </UIText>
                                        <Container
                                            onClick={handleDetailsToggle}
                                            backgroundColor="transparent"
                                            padding={4}
                                            borderRadius={4}
                                            hover={{ backgroundColor: "#2d3748" }}
                                        >
                                            <UIText fontSize={12} color="#4299e1">
                                                {showDetails ? "簡略表示" : "詳細表示"}
                                            </UIText>
                                        </Container>
                                    </Container>
                                    <UIText
                                        fontSize={14}
                                        color="#a0aec0"
                                    >
                                        {showDetails ? character.story : character.story.substring(0, 100) + (character.story.length > 100 ? "..." : "")}
                                    </UIText>
                                </Container>
                            )}
                        </Container>
                    </Container>

                    {/* 統計情報（新機能） */}
                    {character.stats && (
                        <Container
                            flexDirection="column"
                            gap={8}
                            padding={16}
                            backgroundColor="#2d3748"
                            borderRadius={8}
                            marginTop={8}
                        >
                            <UIText fontSize={16} fontWeight="bold" color="#e2e8f0">
                                キャラクター統計
                            </UIText>
                            {renderStatBar("親しみやすさ", character.stats.friendliness, "#48bb78")}
                            {renderStatBar("知性", character.stats.intelligence, "#4299e1")}
                            {renderStatBar("創造性", character.stats.creativity, "#ed8936")}
                            {renderStatBar("エネルギー", character.stats.energy, "#f56565")}
                        </Container>
                    )}

                    {/* Phase 4: VRM制御パネル */}
                    {vrmData && (
                        <Container
                            flexDirection="column"
                            gap={12}
                            padding={16}
                            backgroundColor="#2a2d3a"
                            borderRadius={8}
                            marginTop={8}
                        >
                            <Container
                                flexDirection="row"
                                justifyContent="space-between"
                                alignItems="center"
                            >
                                <UIText fontSize={16} fontWeight="bold" color="#e2e8f0">
                                    VRM制御
                                </UIText>
                                <Container
                                    onClick={() => setShowVRMControls(!showVRMControls)}
                                    backgroundColor="transparent"
                                    padding={4}
                                    borderRadius={4}
                                    hover={{ backgroundColor: "#3d4852" }}
                                >
                                    <UIText fontSize={12} color="#4299e1">
                                        {showVRMControls ? "隠す" : "表示"}
                                    </UIText>
                                </Container>
                            </Container>

                            {showVRMControls && (
                                <Container flexDirection="column" gap={12}>
                                    {/* 表情制御 */}
                                    <Container flexDirection="column" gap={8}>
                                        <UIText fontSize={14} color="#a0aec0">表情</UIText>
                                        <Container flexDirection="row" gap={8} flexWrap="wrap">
                                            {['neutral', 'happy', 'sad', 'angry'].map((emotion) => (
                                                <Container
                                                    key={emotion}
                                                    onClick={() => handleEmotionChange(emotion as any)}
                                                    backgroundColor={selectedEmotion === emotion ? "#4299e1" : "#374151"}
                                                    borderRadius={6}
                                                    padding={8}
                                                    hover={{ backgroundColor: selectedEmotion === emotion ? "#3182ce" : "#4a5568" }}
                                                >
                                                    <UIText fontSize={12} color="#ffffff">
                                                        {emotion === 'neutral' ? '😐' :
                                                            emotion === 'happy' ? '😊' :
                                                                emotion === 'sad' ? '😢' : '😠'}
                                                    </UIText>
                                                </Container>
                                            ))}
                                        </Container>
                                    </Container>

                                    {/* アニメーション制御 */}
                                    <Container flexDirection="column" gap={8}>
                                        <UIText fontSize={14} color="#a0aec0">アニメーション</UIText>
                                        <Container flexDirection="row" gap={8} flexWrap="wrap">
                                            {['idle', 'looking', 'thinking', 'stretch', 'walk', 'sit_anim'].map((anim) => (
                                                <Container
                                                    key={anim}
                                                    onClick={() => handleAnimationTrigger(anim)}
                                                    backgroundColor={selectedAnimation === anim ? "#48bb78" : "#374151"}
                                                    borderRadius={6}
                                                    padding={8}
                                                    hover={{ backgroundColor: selectedAnimation === anim ? "#38a169" : "#4a5568" }}
                                                >
                                                    <UIText fontSize={10} color="#ffffff">
                                                        {anim}
                                                    </UIText>
                                                </Container>
                                            ))}
                                        </Container>
                                    </Container>

                                    {/* ポーズ制御 */}
                                    <Container flexDirection="column" gap={8}>
                                        <UIText fontSize={14} color="#a0aec0">ポーズ</UIText>
                                        <Container flexDirection="row" gap={8}>
                                            {['standing', 'sitting', 'walking'].map((pose) => (
                                                <Container
                                                    key={pose}
                                                    onClick={() => handlePoseChange(pose)}
                                                    backgroundColor="#ed8936"
                                                    borderRadius={6}
                                                    padding={8}
                                                    hover={{ backgroundColor: "#dd6b20" }}
                                                >
                                                    <UIText fontSize={10} color="#ffffff">
                                                        {pose === 'standing' ? '🧍' :
                                                            pose === 'sitting' ? '🪑' : '🚶'}
                                                    </UIText>
                                                </Container>
                                            ))}
                                        </Container>
                                    </Container>

                                    {/* 表情強度スライダー */}
                                    <Container flexDirection="column" gap={8}>
                                        <UIText fontSize={14} color="#a0aec0">
                                            表情強度: {Math.round(emotionIntensity * 100)}%
                                        </UIText>
                                        <Container
                                            width="100%"
                                            height={20}
                                            backgroundColor="#374151"
                                            borderRadius={10}
                                            justifyContent="flex-start"
                                            alignItems="center"
                                            padding={2}
                                        >
                                            <Container
                                                width={`${emotionIntensity * 100}%`}
                                                height="100%"
                                                backgroundColor="#4299e1"
                                                borderRadius={8}
                                            />
                                        </Container>
                                    </Container>
                                </Container>
                            )}
                        </Container>
                    )}

                    {/* アクションボタン */}
                    <Container
                        flexDirection="row"
                        justifyContent="center"
                        gap={12}
                        marginTop="auto"
                        paddingTop={16}
                    >
                        <Container
                            onClick={handleDetailsToggle}
                            backgroundColor="#4299e1"
                            borderRadius={8}
                            padding={12}
                            flexGrow={1}
                            justifyContent="center"
                            alignItems="center"
                            hover={{ backgroundColor: "#3182ce" }}
                        >
                            <UIText fontSize={14} fontWeight="bold" color="#ffffff">
                                詳細設定
                            </UIText>
                        </Container>

                        <Container
                            onClick={handleCloseClick}
                            backgroundColor="#e53e3e"
                            borderRadius={8}
                            padding={12}
                            justifyContent="center"
                            alignItems="center"
                            hover={{ backgroundColor: "#c53030" }}
                        >
                            <UIText fontSize={14} fontWeight="bold" color="#ffffff">
                                閉じる
                            </UIText>
                        </Container>
                    </Container>
                </Container>
            </Root>

            {/* Phase 4: VRMプレビュー（3D空間表示） */}
            {vrmData && showVRMControls && (
                <group position={[panelWidth / 2 + 0.5, 0, 0]}>
                    <RoundedBox
                        args={[0.8, 1.2, 0.05]}
                        radius={0.03}
                        smoothness={4}
                        position={[0, 0, -0.025]}
                    >
                        <meshStandardMaterial
                            color="#0f172a"
                            transparent
                            opacity={0.9}
                            roughness={0.1}
                            metalness={0.2}
                        />
                    </RoundedBox>

                    {/* VRMプレビューエリア */}
                    <group position={[0, 0, 0.1]} scale={[0.25, 0.25, 0.25]}>
                        <primitive object={vrmData.gltf.scene.clone()} />
                    </group>

                    {/* プレビューラベル */}
                    <Text
                        position={[0, 0.65, 0.05]}
                        fontSize={0.05}
                        color="#4299e1"
                        anchorX="center"
                        anchorY="middle"
                    >
                        VRM Preview
                    </Text>

                    {/* 現在の表情・アニメーション表示 */}
                    <Text
                        position={[0, -0.65, 0.05]}
                        fontSize={0.03}
                        color="#a0aec0"
                        anchorX="center"
                        anchorY="middle"
                    >
                        {selectedEmotion} / {selectedAnimation}
                    </Text>
                </group>
            )}

            {/* 3D装飾要素 */}
            <group>
                {/* コーナー装飾 */}
                {[
                    [-panelWidth / 2 + 0.1, panelHeight / 2 - 0.1],
                    [panelWidth / 2 - 0.1, panelHeight / 2 - 0.1],
                    [-panelWidth / 2 + 0.1, -panelHeight / 2 + 0.1],
                    [panelWidth / 2 - 0.1, -panelHeight / 2 + 0.1]
                ].map(([x, y], index) => (
                    <Sphere
                        key={index}
                        args={[0.02]}
                        position={[x, y, 0.05]}
                    >
                        <meshBasicMaterial
                            color="#4299e1"
                            transparent
                            opacity={0.8}
                        />
                    </Sphere>
                ))}
            </group>
        </group>
    );
}