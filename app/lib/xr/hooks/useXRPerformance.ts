import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * Phase 2: XRパフォーマンス最適化フック
 * - フレームレート監視
 * - メモリ使用量最適化
 * - 不要な再レンダリング防止
 * - LOD（Level of Detail）管理
 */

interface PerformanceMetrics {
    fps: number;
    averageFps: number;
    frameTime: number;
    memoryUsage?: number;
    gpuMemoryUsage?: number;
}

interface PerformanceSettings {
    targetFps: number;
    maxLODDistance: number;
    cullDistance: number;
    enableOcclusion: boolean;
    enableFrustumCulling: boolean;
}

export function useXRPerformance(settings: Partial<PerformanceSettings> = {}) {
    const frameCountRef = useRef(0);
    const lastTimeRef = useRef(performance.now());
    const fpsHistoryRef = useRef<number[]>([]);

    const [metrics, setMetrics] = useState<PerformanceMetrics>({
        fps: 60,
        averageFps: 60,
        frameTime: 16.67,
    });

    const [performanceLevel, setPerformanceLevel] = useState<
        "high" | "medium" | "low"
    >("high");

    const defaultSettings: PerformanceSettings = {
        targetFps: 60,
        maxLODDistance: 20,
        cullDistance: 50,
        enableOcclusion: true,
        enableFrustumCulling: true,
        ...settings,
    };

    // フレームレート監視
    useFrame(() => {
        const currentTime = performance.now();
        const deltaTime = currentTime - lastTimeRef.current;

        frameCountRef.current++;

        // 1秒ごとにFPSを計算
        if (deltaTime >= 1000) {
            const fps = (frameCountRef.current * 1000) / deltaTime;

            // FPS履歴を更新
            fpsHistoryRef.current.push(fps);
            if (fpsHistoryRef.current.length > 30) { // 30秒の履歴を保持
                fpsHistoryRef.current.shift();
            }

            // 平均FPSを計算
            const averageFps = fpsHistoryRef.current.reduce((a, b) =>
                a + b, 0) / fpsHistoryRef.current.length;

            setMetrics({
                fps,
                averageFps,
                frameTime: 1000 / fps,
                // メモリ使用量（利用可能な場合）
                memoryUsage: (performance as any).memory?.usedJSHeapSize,
                gpuMemoryUsage: (performance as any).memory?.totalJSHeapSize,
            });

            // パフォーマンスレベルの動的調整
            if (averageFps < defaultSettings.targetFps * 0.7) {
                setPerformanceLevel("low");
            } else if (averageFps < defaultSettings.targetFps * 0.9) {
                setPerformanceLevel("medium");
            } else {
                setPerformanceLevel("high");
            }

            frameCountRef.current = 0;
            lastTimeRef.current = currentTime;
        }
    });

    // メモリリークの検出と警告
    useEffect(() => {
        if (metrics.memoryUsage && metrics.memoryUsage > 100 * 1024 * 1024) { // 100MB以上
            console.warn(
                "High memory usage detected:",
                metrics.memoryUsage / 1024 / 1024,
                "MB",
            );
        }
    }, [metrics.memoryUsage]);

    // パフォーマンス設定の自動調整
    const getOptimizedSettings = () => {
        switch (performanceLevel) {
            case "low":
                return {
                    renderScale: 0.7,
                    shadowMapSize: 512,
                    antialias: false,
                    maxLights: 2,
                    particleCount: 50,
                    enablePostProcessing: false,
                };
            case "medium":
                return {
                    renderScale: 0.85,
                    shadowMapSize: 1024,
                    antialias: true,
                    maxLights: 4,
                    particleCount: 100,
                    enablePostProcessing: true,
                };
            case "high":
                return {
                    renderScale: 1.0,
                    shadowMapSize: 2048,
                    antialias: true,
                    maxLights: 8,
                    particleCount: 200,
                    enablePostProcessing: true,
                };
        }
    };

    // LOD（Level of Detail）計算
    const calculateLOD = (distance: number): number => {
        if (distance < defaultSettings.maxLODDistance * 0.3) return 0; // 高品質
        if (distance < defaultSettings.maxLODDistance * 0.6) return 1; // 中品質
        if (distance < defaultSettings.maxLODDistance) return 2; // 低品質
        return 3; // 非表示
    };

    // カリング判定
    const shouldCull = (distance: number): boolean => {
        return distance > defaultSettings.cullDistance;
    };

    // ガベージコレクション推奨タイミング
    const shouldTriggerGC = (): boolean => {
        return metrics.memoryUsage
            ? metrics.memoryUsage > 80 * 1024 * 1024
            : false;
    };

    // フレームレート安定化
    const stabilizeFrameRate = () => {
        if (metrics.fps < defaultSettings.targetFps * 0.8) {
            // フレームレートが低い場合の緊急対応
            console.log("Applying emergency performance optimizations");
            return {
                shouldReduceQuality: true,
                shouldDisableEffects: true,
                shouldReduceParticles: true,
            };
        }
        return {
            shouldReduceQuality: false,
            shouldDisableEffects: false,
            shouldReduceParticles: false,
        };
    };

    return {
        metrics,
        performanceLevel,
        settings: defaultSettings,
        optimizedSettings: getOptimizedSettings(),
        calculateLOD,
        shouldCull,
        shouldTriggerGC,
        stabilizeFrameRate,
    };
}

// デバウンス用フック（不要な再レンダリング防止）
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

// メモ化用フック（重い計算の最適化）
export function useMemoizedComputation<T, P extends any[]>(
    computation: (...args: P) => T,
    dependencies: P,
): T {
    const memoRef = useRef<{ deps: P; result: T } | null>(null);

    // 依存関係が変わった場合のみ再計算
    const hasChanged = !memoRef.current ||
        dependencies.some((dep, index) => dep !== memoRef.current!.deps[index]);

    if (hasChanged) {
        const result = computation(...dependencies);
        memoRef.current = { deps: [...dependencies] as P, result };
    }

    return memoRef.current!.result;
}

// XR特化型パフォーマンス監視
export function useXRSystemHealth() {
    const [systemHealth, setSystemHealth] = useState({
        handTrackingLatency: 0,
        renderLatency: 0,
        gestureRecognitionAccuracy: 100,
        menuResponseTime: 0,
    });

    const measureHandTrackingLatency = () => {
        const start = performance.now();
        return () => {
            const latency = performance.now() - start;
            setSystemHealth((prev) => ({
                ...prev,
                handTrackingLatency: latency,
            }));
        };
    };

    const measureMenuResponseTime = () => {
        const start = performance.now();
        return () => {
            const responseTime = performance.now() - start;
            setSystemHealth((prev) => ({
                ...prev,
                menuResponseTime: responseTime,
            }));
        };
    };

    return {
        systemHealth,
        measureHandTrackingLatency,
        measureMenuResponseTime,
    };
}

// Phase 3: 高度なインタラクション監視フック
export function useInteractionPerformance() {
    const [interactionMetrics, setInteractionMetrics] = useState({
        gestureRecognitionLatency: 0,
        raycastingLatency: 0,
        selectionAccuracy: 100,
        interactionErrors: 0,
        averageResponseTime: 0,
        gestureSuccessRate: 100,
        totalInteractions: 0,
    });

    const responseTimeBuffer = useRef<number[]>([]);
    const gestureAttempts = useRef(0);
    const gestureSuccesses = useRef(0);

    // ジェスチャー認識遅延の測定
    const measureGestureLatency = () => {
        const start = performance.now();
        return (success: boolean = true) => {
            const latency = performance.now() - start;
            gestureAttempts.current++;
            if (success) gestureSuccesses.current++;

            setInteractionMetrics((prev) => ({
                ...prev,
                gestureRecognitionLatency: latency,
                gestureSuccessRate:
                    (gestureSuccesses.current / gestureAttempts.current) * 100,
            }));
        };
    };

    // レイキャスティング遅延の測定
    const measureRaycastLatency = () => {
        const start = performance.now();
        return () => {
            const latency = performance.now() - start;
            setInteractionMetrics((prev) => ({
                ...prev,
                raycastingLatency: latency,
            }));
        };
    };

    // インタラクション応答時間の記録
    const recordInteractionTime = (responseTime: number) => {
        responseTimeBuffer.current.push(responseTime);
        if (responseTimeBuffer.current.length > 50) {
            responseTimeBuffer.current.shift();
        }

        const averageResponseTime =
            responseTimeBuffer.current.reduce((sum, time) => sum + time, 0) /
            responseTimeBuffer.current.length;

        setInteractionMetrics((prev) => ({
            ...prev,
            averageResponseTime,
            totalInteractions: prev.totalInteractions + 1,
        }));
    };

    // エラーの記録
    const recordInteractionError = () => {
        setInteractionMetrics((prev) => ({
            ...prev,
            interactionErrors: prev.interactionErrors + 1,
        }));
    };

    // 選択精度の更新
    const updateSelectionAccuracy = (accuracy: number) => {
        setInteractionMetrics((prev) => ({
            ...prev,
            selectionAccuracy: accuracy,
        }));
    };

    // パフォーマンス診断
    const getDiagnostics = () => {
        const {
            gestureRecognitionLatency,
            raycastingLatency,
            averageResponseTime,
            gestureSuccessRate,
        } = interactionMetrics;

        return {
            gesturePerformance: gestureRecognitionLatency < 30
                ? "excellent"
                : gestureRecognitionLatency < 50
                ? "good"
                : gestureRecognitionLatency < 100
                ? "fair"
                : "poor",
            raycastPerformance: raycastingLatency < 10
                ? "excellent"
                : raycastingLatency < 20
                ? "good"
                : raycastingLatency < 50
                ? "fair"
                : "poor",
            overallResponsiveness: averageResponseTime < 100
                ? "excellent"
                : averageResponseTime < 200
                ? "good"
                : averageResponseTime < 500
                ? "fair"
                : "poor",
            gestureReliability: gestureSuccessRate > 95
                ? "excellent"
                : gestureSuccessRate > 85
                ? "good"
                : gestureSuccessRate > 70
                ? "fair"
                : "poor",
        };
    };

    return {
        interactionMetrics,
        measureGestureLatency,
        measureRaycastLatency,
        recordInteractionTime,
        recordInteractionError,
        updateSelectionAccuracy,
        getDiagnostics,
    };
}

// ハプティックフィードバック品質監視
export function useHapticPerformance() {
    const [hapticMetrics, setHapticMetrics] = useState({
        hapticLatency: 0,
        hapticSuccessRate: 100,
        totalHapticEvents: 0,
        failedHapticEvents: 0,
    });

    const measureHapticLatency = () => {
        const start = performance.now();
        return (success: boolean = true) => {
            const latency = performance.now() - start;

            setHapticMetrics((prev) => {
                const newTotal = prev.totalHapticEvents + 1;
                const newFailed = success
                    ? prev.failedHapticEvents
                    : prev.failedHapticEvents + 1;

                return {
                    hapticLatency: latency,
                    hapticSuccessRate: ((newTotal - newFailed) / newTotal) *
                        100,
                    totalHapticEvents: newTotal,
                    failedHapticEvents: newFailed,
                };
            });
        };
    };

    return {
        hapticMetrics,
        measureHapticLatency,
    };
}

// リアルタイム品質調整システム
export function useAdaptiveQuality() {
    const { metrics, performanceLevel } = useXRPerformance();
    const { interactionMetrics } = useInteractionPerformance();
    const [qualitySettings, setQualitySettings] = useState({
        gestureUpdateRate: 60, // Hz
        raycastUpdateRate: 60, // Hz
        hapticIntensity: 1.0,
        uiComplexity: "high" as "low" | "medium" | "high",
        enableAdvancedGestures: true,
        enableMultiTouch: true,
    });

    // 品質設定の動的調整
    useEffect(() => {
        const shouldReduceQuality = metrics.fps < 45 ||
            interactionMetrics.averageResponseTime > 150 ||
            interactionMetrics.gestureRecognitionLatency > 100;

        const shouldIncreaseQuality = metrics.fps > 55 &&
            interactionMetrics.averageResponseTime < 100 &&
            interactionMetrics.gestureRecognitionLatency < 50;

        if (shouldReduceQuality) {
            setQualitySettings((prev) => ({
                ...prev,
                gestureUpdateRate: Math.max(30, prev.gestureUpdateRate - 10),
                raycastUpdateRate: Math.max(30, prev.raycastUpdateRate - 10),
                hapticIntensity: Math.max(0.5, prev.hapticIntensity - 0.1),
                uiComplexity: prev.uiComplexity === "high"
                    ? "medium"
                    : prev.uiComplexity === "medium"
                    ? "low"
                    : "low",
                enableAdvancedGestures: prev.uiComplexity === "low"
                    ? false
                    : prev.enableAdvancedGestures,
            }));
        } else if (shouldIncreaseQuality) {
            setQualitySettings((prev) => ({
                ...prev,
                gestureUpdateRate: Math.min(60, prev.gestureUpdateRate + 5),
                raycastUpdateRate: Math.min(60, prev.raycastUpdateRate + 5),
                hapticIntensity: Math.min(1.0, prev.hapticIntensity + 0.05),
                uiComplexity: prev.uiComplexity === "low"
                    ? "medium"
                    : prev.uiComplexity === "medium"
                    ? "high"
                    : "high",
                enableAdvancedGestures: true,
            }));
        }
    }, [
        metrics.fps,
        interactionMetrics.averageResponseTime,
        interactionMetrics.gestureRecognitionLatency,
    ]);

    return {
        qualitySettings,
        performanceLevel,
        shouldUseReducedGestures: qualitySettings.uiComplexity === "low",
        shouldUseSimpleHaptics: qualitySettings.hapticIntensity < 0.8,
    };
}

// デバッグモード用の詳細ログ
export function useInteractionDebugger(enabled: boolean = false) {
    const [debugLogs, setDebugLogs] = useState<
        Array<{
            timestamp: number;
            type: "gesture" | "raycast" | "haptic" | "error";
            message: string;
            data?: any;
        }>
    >([]);

    const log = (
        type: "gesture" | "raycast" | "haptic" | "error",
        message: string,
        data?: any,
    ) => {
        if (!enabled) return;

        const logEntry = {
            timestamp: Date.now(),
            type,
            message,
            data,
        };

        setDebugLogs((prev) => {
            const newLogs = [...prev, logEntry];
            // 最新100件のログを保持
            return newLogs.slice(-100);
        });

        console.log(`[XR Debug] ${type.toUpperCase()}: ${message}`, data);
    };

    const clearLogs = () => setDebugLogs([]);

    const exportLogs = () => {
        return JSON.stringify(debugLogs, null, 2);
    };

    return {
        debugLogs,
        log,
        clearLogs,
        exportLogs,
    };
}

/**
 * Phase 4: VRM専用パフォーマンス監視フック
 * VRMキャラクターのレンダリングとアニメーション最適化
 */
export function useVRMPerformance() {
    const [vrmMetrics, setVrmMetrics] = useState({
        vrmRenderTime: 0,
        animationUpdateTime: 0,
        vrmMemoryUsage: 0,
        activeVRMCount: 0,
        blendShapeUpdates: 0,
        lookAtUpdates: 0,
        animationClips: 0,
        textureMemory: 0,
        materialCount: 0,
    });

    const [vrmOptimizationSettings, setVrmOptimizationSettings] = useState({
        maxActiveVRMs: 3,
        animationLOD: "high" as "low" | "medium" | "high",
        blendShapeUpdatesPerFrame: 60,
        lookAtUpdateRate: 30,
        enableFacialAnimations: true,
        enableLookAt: true,
        textureQuality: "high" as "low" | "medium" | "high",
        useCompressedTextures: false,
    });

    // VRMレンダリング遅延の測定
    const measureVRMRenderTime = () => {
        const start = performance.now();
        return () => {
            const renderTime = performance.now() - start;
            setVrmMetrics((prev) => ({
                ...prev,
                vrmRenderTime: renderTime,
            }));
        };
    };

    // アニメーション更新時間の測定
    const measureAnimationUpdateTime = () => {
        const start = performance.now();
        return () => {
            const updateTime = performance.now() - start;
            setVrmMetrics((prev) => ({
                ...prev,
                animationUpdateTime: updateTime,
            }));
        };
    };

    // VRMメモリ使用量の更新
    const updateVRMMemoryUsage = (
        vrmCount: number,
        textureMemory: number,
        materialCount: number,
    ) => {
        setVrmMetrics((prev) => ({
            ...prev,
            activeVRMCount: vrmCount,
            textureMemory,
            materialCount,
            vrmMemoryUsage: textureMemory + (materialCount * 1024), // 簡易計算
        }));
    };

    // ブレンドシェイプ更新回数の記録
    const recordBlendShapeUpdate = () => {
        setVrmMetrics((prev) => ({
            ...prev,
            blendShapeUpdates: prev.blendShapeUpdates + 1,
        }));
    };

    // 視線制御更新回数の記録
    const recordLookAtUpdate = () => {
        setVrmMetrics((prev) => ({
            ...prev,
            lookAtUpdates: prev.lookAtUpdates + 1,
        }));
    };

    // VRM最適化設定の動的調整
    const optimizeVRMSettings = (
        currentFPS: number,
        targetFPS: number = 60,
    ) => {
        if (currentFPS < targetFPS * 0.8) {
            // パフォーマンスが低い場合の最適化
            setVrmOptimizationSettings((prev) => ({
                ...prev,
                animationLOD: prev.animationLOD === "high" ? "medium" : "low",
                blendShapeUpdatesPerFrame: Math.max(
                    30,
                    prev.blendShapeUpdatesPerFrame - 10,
                ),
                lookAtUpdateRate: Math.max(15, prev.lookAtUpdateRate - 5),
                enableFacialAnimations: prev.animationLOD === "low"
                    ? false
                    : prev.enableFacialAnimations,
                textureQuality: prev.textureQuality === "high"
                    ? "medium"
                    : "low",
                useCompressedTextures: true,
            }));
        } else if (currentFPS > targetFPS * 0.95) {
            // パフォーマンスが良い場合の品質向上
            setVrmOptimizationSettings((prev) => ({
                ...prev,
                animationLOD: prev.animationLOD === "low" ? "medium" : "high",
                blendShapeUpdatesPerFrame: Math.min(
                    60,
                    prev.blendShapeUpdatesPerFrame + 5,
                ),
                lookAtUpdateRate: Math.min(30, prev.lookAtUpdateRate + 2),
                enableFacialAnimations: true,
                textureQuality: prev.textureQuality === "low"
                    ? "medium"
                    : "high",
                useCompressedTextures: false,
            }));
        }
    };

    // VRMボトルネック検出
    const detectVRMBottlenecks = () => {
        const bottlenecks: string[] = [];

        if (vrmMetrics.vrmRenderTime > 16) {
            bottlenecks.push("VRM rendering is too slow");
        }

        if (vrmMetrics.animationUpdateTime > 5) {
            bottlenecks.push("Animation updates are consuming too much time");
        }

        if (vrmMetrics.vrmMemoryUsage > 50 * 1024 * 1024) {
            bottlenecks.push("VRM memory usage is too high");
        }

        if (vrmMetrics.activeVRMCount > vrmOptimizationSettings.maxActiveVRMs) {
            bottlenecks.push("Too many active VRM models");
        }

        return bottlenecks;
    };

    // VRMパフォーマンス レポート生成
    const generateVRMPerformanceReport = () => {
        const bottlenecks = detectVRMBottlenecks();

        return {
            timestamp: Date.now(),
            metrics: { ...vrmMetrics },
            settings: { ...vrmOptimizationSettings },
            bottlenecks,
            recommendations: generateVRMRecommendations(bottlenecks),
            score: calculateVRMPerformanceScore(),
        };
    };

    // VRM最適化の推奨事項
    const generateVRMRecommendations = (bottlenecks: string[]) => {
        const recommendations: string[] = [];

        if (bottlenecks.includes("VRM rendering is too slow")) {
            recommendations.push(
                "Reduce VRM polygon count or use lower LOD models",
            );
            recommendations.push("Enable VRM occlusion culling");
        }

        if (
            bottlenecks.includes(
                "Animation updates are consuming too much time",
            )
        ) {
            recommendations.push("Reduce animation update frequency");
            recommendations.push("Use simpler animation blending");
        }

        if (bottlenecks.includes("VRM memory usage is too high")) {
            recommendations.push("Use compressed textures");
            recommendations.push("Reduce texture resolution");
            recommendations.push("Unload unused VRM models");
        }

        if (bottlenecks.includes("Too many active VRM models")) {
            recommendations.push("Implement VRM pooling system");
            recommendations.push("Unload distant or occluded VRM models");
        }

        return recommendations;
    };

    // VRMパフォーマンススコア計算
    const calculateVRMPerformanceScore = (): number => {
        let score = 100;

        // レンダリング時間の評価
        if (vrmMetrics.vrmRenderTime > 16) score -= 20;
        else if (vrmMetrics.vrmRenderTime > 10) score -= 10;

        // アニメーション更新時間の評価
        if (vrmMetrics.animationUpdateTime > 5) score -= 15;
        else if (vrmMetrics.animationUpdateTime > 3) score -= 8;

        // メモリ使用量の評価
        const memoryMB = vrmMetrics.vrmMemoryUsage / (1024 * 1024);
        if (memoryMB > 100) score -= 25;
        else if (memoryMB > 50) score -= 15;
        else if (memoryMB > 25) score -= 10;

        // アクティブVRM数の評価
        if (vrmMetrics.activeVRMCount > vrmOptimizationSettings.maxActiveVRMs) {
            score -= 15;
        }

        return Math.max(0, score);
    };

    // メモリリーク検出（VRM専用）
    const detectVRMMemoryLeaks = () => {
        const memoryGrowthRate = 1024 * 1024; // 1MB per minute threshold

        return {
            hasMemoryLeak: vrmMetrics.vrmMemoryUsage > memoryGrowthRate,
            severity: vrmMetrics.vrmMemoryUsage > memoryGrowthRate * 2
                ? "high"
                : "medium",
            recommendedAction:
                "Check for unreleased VRM resources and textures",
        };
    };

    return {
        vrmMetrics,
        vrmOptimizationSettings,
        measureVRMRenderTime,
        measureAnimationUpdateTime,
        updateVRMMemoryUsage,
        recordBlendShapeUpdate,
        recordLookAtUpdate,
        optimizeVRMSettings,
        detectVRMBottlenecks,
        generateVRMPerformanceReport,
        calculateVRMPerformanceScore,
        detectVRMMemoryLeaks,
    };
}

/**
 * VRMテクスチャ最適化フック
 */
export function useVRMTextureOptimization() {
    const [textureMetrics, setTextureMetrics] = useState({
        totalTextures: 0,
        textureMemoryUsage: 0,
        compressionRatio: 0,
        loadingTime: 0,
    });

    // テクスチャ最適化の測定
    const measureTextureOptimization = (
        originalSize: number,
        compressedSize: number,
        loadTime: number,
    ) => {
        setTextureMetrics((prev) => ({
            ...prev,
            totalTextures: prev.totalTextures + 1,
            textureMemoryUsage: prev.textureMemoryUsage + compressedSize,
            compressionRatio: compressedSize / originalSize,
            loadingTime: loadTime,
        }));
    };

    return {
        textureMetrics,
        measureTextureOptimization,
    };
}
