import { Euler, Vector3 } from "three";
import {
    ComboGestureDetails,
    GestureRecognizer,
    LongPressGestureDetails,
    PinchGestureDetails,
    SwipeGestureDetails,
} from "../hands/GestureRecognizer";
import { HandTrackingManager } from "../hands/HandTrackingManager";
import {
    InteractableObject,
    MultiTargetResult,
    RaycastingManager,
    RaycastResult,
} from "./RaycastingManager";
import {
    GestureResult,
    GestureType,
    XRHandPose,
} from "../hands/types/HandTypes";

/**
 * インタラクション状態の定義
 */
export enum InteractionState {
    IDLE = "idle",
    HOVERING = "hovering",
    SELECTING = "selecting",
    DRAGGING = "dragging",
    PINCHING = "pinching",
    SWIPING = "swiping",
    LONG_PRESSING = "long_pressing",
}

/**
 * インタラクションイベント
 */
export interface InteractionEvent {
    type:
        | "hover"
        | "select"
        | "drag"
        | "pinch"
        | "swipe"
        | "longpress"
        | "combo";
    state: InteractionState;
    object?: InteractableObject;
    position: Vector3;
    handedness: "left" | "right";
    details?: any;
    timestamp: number;
}

/**
 * 触覚フィードバック設定
 */
export interface HapticFeedbackConfig {
    enabled: boolean;
    intensity: number; // 0.0 - 1.0
    duration: number; // ms
    pattern: "click" | "hover" | "success" | "error" | "warning";
}

/**
 * インタラクション設定
 */
export interface InteractionConfig {
    hapticFeedback: HapticFeedbackConfig;
    gestureEnabled: {
        pinch: boolean;
        swipe: boolean;
        longPress: boolean;
        combo: boolean;
    };
    raycastEnabled: boolean;
    multiSelectEnabled: boolean;
    dragThreshold: number; // meters
    hoverDelay: number; // ms
}

/**
 * インタラクション履歴
 */
export interface InteractionHistory {
    events: InteractionEvent[];
    analytics: {
        totalInteractions: number;
        averageResponseTime: number;
        mostUsedGesture: GestureType;
        errorCount: number;
    };
}

/**
 * WebXRインタラクション統合マネージャー
 * ハンドトラッキング、ジェスチャー認識、レイキャスティングを統合管理
 */
export class InteractionManager {
    private gestureRecognizer: GestureRecognizer;
    private handTrackingManager: HandTrackingManager;
    private raycastingManager: RaycastingManager;

    private currentState: InteractionState = InteractionState.IDLE;
    private interactionHistory: InteractionHistory;
    private config: InteractionConfig;

    // 状態管理
    private selectedObjects: Set<InteractableObject> = new Set();
    private hoveredObjects: Set<InteractableObject> = new Set();
    private dragState: Map<
        string,
        { object: InteractableObject; startPosition: Vector3; offset: Vector3 }
    > = new Map();

    // イベントリスナー
    private eventListeners: Map<string, ((event: InteractionEvent) => void)[]> =
        new Map();

    // パフォーマンス監視
    private lastInteractionTime = 0;
    private responseTimeBuffer: number[] = [];
    private readonly MAX_RESPONSE_TIME_SAMPLES = 100;

    constructor(
        gestureRecognizer: GestureRecognizer,
        handTrackingManager: HandTrackingManager,
        raycastingManager: RaycastingManager,
        config?: Partial<InteractionConfig>,
    ) {
        this.gestureRecognizer = gestureRecognizer;
        this.handTrackingManager = handTrackingManager;
        this.raycastingManager = raycastingManager;

        // デフォルト設定
        this.config = {
            hapticFeedback: {
                enabled: true,
                intensity: 0.5,
                duration: 50,
                pattern: "click",
            },
            gestureEnabled: {
                pinch: true,
                swipe: true,
                longPress: true,
                combo: true,
            },
            raycastEnabled: true,
            multiSelectEnabled: true,
            dragThreshold: 0.02, // 2cm
            hoverDelay: 200, // ms
            ...config,
        };

        // 履歴の初期化
        this.interactionHistory = {
            events: [],
            analytics: {
                totalInteractions: 0,
                averageResponseTime: 0,
                mostUsedGesture: GestureType.POINTING,
                errorCount: 0,
            },
        };

        this.setupEventListeners();
    }

    /**
     * メインの更新ループ
     */
    update(): void {
        try {
            const handData = this.handTrackingManager.getHandTrackingData();

            if (!handData.left && !handData.right) {
                this.handleNoHandsDetected();
                return;
            }

            // ジェスチャー認識
            this.processGestures(handData.left, handData.right);

            // レイキャスティング
            if (this.config.raycastEnabled) {
                this.processRaycasting(handData.left, handData.right);
            }

            // 状態管理の更新
            this.updateInteractionState();

            // 古い状態のクリーンアップ
            this.cleanupStates();
        } catch (error) {
            console.error("Error in InteractionManager update:", error);
            this.recordError();
        }
    }

    /**
     * ジェスチャー処理
     */
    private processGestures(
        leftHand?: XRHandPose,
        rightHand?: XRHandPose,
    ): void {
        // 基本ジェスチャー
        const gestureResult = this.gestureRecognizer.recognizeGesture(
            leftHand,
            rightHand,
        );
        if (gestureResult) {
            this.handleGestureResult(gestureResult);
        }

        // 高度なジェスチャー
        if (rightHand) {
            this.processAdvancedGestures(rightHand, "right");
        }
        if (leftHand) {
            this.processAdvancedGestures(leftHand, "left");
        }
    }

    /**
     * 高度なジェスチャー処理
     */
    private processAdvancedGestures(
        handPose: XRHandPose,
        handedness: "left" | "right",
    ): void {
        // ピンチジェスチャー
        if (this.config.gestureEnabled.pinch) {
            const pinchResult = this.gestureRecognizer.detectPinchGesture(
                handPose,
                handedness,
            );
            if (pinchResult) {
                this.handlePinchGesture(pinchResult, handedness);
            }
        }

        // スワイプジェスチャー
        if (this.config.gestureEnabled.swipe) {
            const swipeResult = this.gestureRecognizer.detectSwipeGesture(
                handPose,
                handedness,
            );
            if (swipeResult) {
                this.handleSwipeGesture(swipeResult, handedness);
            }
        }

        // 長押しジェスチャー
        if (this.config.gestureEnabled.longPress) {
            const longPressResult = this.gestureRecognizer
                .detectLongPressGesture(handPose, handedness);
            if (longPressResult) {
                this.handleLongPressGesture(longPressResult, handedness);
            }
        }
    }

    /**
     * レイキャスティング処理
     */
    private processRaycasting(
        leftHand?: XRHandPose,
        rightHand?: XRHandPose,
    ): void {
        let raycastResults: MultiTargetResult | null = null;

        if (this.config.multiSelectEnabled) {
            raycastResults = this.raycastingManager.performMultiTargetRaycast(
                leftHand,
                rightHand,
            );
        } else {
            // 単一ハンドレイキャスト
            const hand = rightHand || leftHand;
            const handedness = rightHand ? "right" : "left";
            if (hand) {
                const results = this.raycastingManager.performRaycast(
                    hand,
                    handedness,
                );
                if (results.length > 0) {
                    raycastResults = {
                        primary: results[0],
                        secondary: results.slice(1),
                        selectionMode: "single",
                    };
                }
            }
        }

        if (raycastResults) {
            this.handleRaycastResults(raycastResults);
        }
    }

    /**
     * 基本ジェスチャー結果の処理
     */
    private handleGestureResult(result: GestureResult): void {
        const event: InteractionEvent = {
            type: "select",
            state: this.currentState,
            position: result.position || new Vector3(),
            handedness: "right", // デフォルト
            details: result,
            timestamp: Date.now(),
        };

        switch (result.type) {
            case GestureType.ROCK_AND_ROLL:
                this.setState(InteractionState.SELECTING);
                break;
            case GestureType.POINTING:
                this.setState(InteractionState.HOVERING);
                break;
            case GestureType.TAPPING:
                this.setState(InteractionState.SELECTING);
                this.triggerHapticFeedback("click");
                break;
        }

        this.emitEvent(event);
        this.recordInteraction(result.type);
    }

    /**
     * ピンチジェスチャーの処理
     */
    private handlePinchGesture(
        pinch: PinchGestureDetails,
        handedness: "left" | "right",
    ): void {
        this.setState(InteractionState.PINCHING);

        const event: InteractionEvent = {
            type: "pinch",
            state: this.currentState,
            position: new Vector3(), // ピンチ位置を計算
            handedness,
            details: pinch,
            timestamp: Date.now(),
        };

        this.emitEvent(event);
        this.triggerHapticFeedback("hover");
    }

    /**
     * スワイプジェスチャーの処理
     */
    private handleSwipeGesture(
        swipe: SwipeGestureDetails,
        handedness: "left" | "right",
    ): void {
        this.setState(InteractionState.SWIPING);

        const event: InteractionEvent = {
            type: "swipe",
            state: this.currentState,
            position: swipe.endPosition,
            handedness,
            details: swipe,
            timestamp: Date.now(),
        };

        this.emitEvent(event);
        this.triggerHapticFeedback("success");
    }

    /**
     * 長押しジェスチャーの処理
     */
    private handleLongPressGesture(
        longPress: LongPressGestureDetails,
        handedness: "left" | "right",
    ): void {
        this.setState(InteractionState.LONG_PRESSING);

        const event: InteractionEvent = {
            type: "longpress",
            state: this.currentState,
            position: longPress.position,
            handedness,
            details: longPress,
            timestamp: Date.now(),
        };

        this.emitEvent(event);
        this.triggerHapticFeedback("warning");
    }

    /**
     * レイキャスト結果の処理
     */
    private handleRaycastResults(results: MultiTargetResult): void {
        // ホバー状態の更新
        this.updateHoverState(results);

        // 選択状態の更新
        if (this.currentState === InteractionState.SELECTING) {
            this.updateSelectionState(results);
        }

        // ドラッグ状態の更新
        if (this.currentState === InteractionState.DRAGGING) {
            this.updateDragState(results);
        }
    }

    /**
     * ホバー状態の更新
     */
    private updateHoverState(results: MultiTargetResult): void {
        // 以前のホバー状態をクリア
        this.hoveredObjects.forEach((obj) => {
            const event: InteractionEvent = {
                type: "hover",
                state: InteractionState.IDLE,
                object: obj,
                position: new Vector3(),
                handedness: results.primary.handedness,
                timestamp: Date.now(),
            };
            this.emitEvent(event);
        });
        this.hoveredObjects.clear();

        // 新しいホバー状態を設定
        this.hoveredObjects.add(results.primary.object);
        results.secondary.forEach((result) => {
            this.hoveredObjects.add(result.object);
        });

        // ホバーイベントを発火
        this.hoveredObjects.forEach((obj) => {
            const event: InteractionEvent = {
                type: "hover",
                state: InteractionState.HOVERING,
                object: obj,
                position: results.primary.point,
                handedness: results.primary.handedness,
                timestamp: Date.now(),
            };
            this.emitEvent(event);
        });
    }

    /**
     * 選択状態の更新
     */
    private updateSelectionState(results: MultiTargetResult): void {
        if (
            results.selectionMode === "multi" && this.config.multiSelectEnabled
        ) {
            // マルチ選択
            this.selectedObjects.add(results.primary.object);
            results.secondary.forEach((result) => {
                this.selectedObjects.add(result.object);
            });
        } else {
            // 単一選択
            this.selectedObjects.clear();
            this.selectedObjects.add(results.primary.object);
        }

        this.triggerHapticFeedback("click");
    }

    /**
     * ドラッグ状態の更新
     */
    private updateDragState(results: MultiTargetResult): void {
        const handKey = results.primary.handedness;
        const dragData = this.dragState.get(handKey);

        if (dragData) {
            // ドラッグ中のオブジェクト位置更新
            const newPosition = new Vector3().subVectors(
                results.primary.point,
                dragData.offset,
            );

            const event: InteractionEvent = {
                type: "drag",
                state: InteractionState.DRAGGING,
                object: dragData.object,
                position: newPosition,
                handedness: results.primary.handedness,
                timestamp: Date.now(),
            };

            this.emitEvent(event);
        }
    }

    /**
     * 手が検出されない場合の処理
     */
    private handleNoHandsDetected(): void {
        if (this.currentState !== InteractionState.IDLE) {
            this.setState(InteractionState.IDLE);
            this.selectedObjects.clear();
            this.hoveredObjects.clear();
            this.dragState.clear();
        }
    }

    /**
     * インタラクション状態の更新
     */
    private updateInteractionState(): void {
        // 自動状態遷移のロジック
        const now = Date.now();

        // アイドル状態への自動遷移
        if (now - this.lastInteractionTime > 5000) { // 5秒間操作がない場合
            this.setState(InteractionState.IDLE);
        }
    }

    /**
     * 古い状態のクリーンアップ
     */
    private cleanupStates(): void {
        this.gestureRecognizer.cleanupAdvancedGestureStates();

        // 古いドラッグ状態の削除
        const now = Date.now();
        for (const [key, dragData] of this.dragState.entries()) {
            if (now - this.lastInteractionTime > 10000) { // 10秒でタイムアウト
                this.dragState.delete(key);
            }
        }
    }

    /**
     * 触覚フィードバック
     */
    private triggerHapticFeedback(
        pattern: HapticFeedbackConfig["pattern"],
    ): void {
        if (!this.config.hapticFeedback.enabled) return;

        try {
            // WebXR Haptics APIの実装
            const session = this.handTrackingManager.getXRSession();
            if (session && session.inputSources) {
                session.inputSources.forEach((inputSource: any) => {
                    if (
                        inputSource.gamepad &&
                        inputSource.gamepad.hapticActuators
                    ) {
                        inputSource.gamepad.hapticActuators.forEach(
                            (actuator: any) => {
                                if (actuator.pulse) {
                                    actuator.pulse(
                                        this.config.hapticFeedback.intensity,
                                        this.config.hapticFeedback.duration,
                                    );
                                }
                            },
                        );
                    }
                });
            }
        } catch (error) {
            console.warn("Haptic feedback not supported:", error);
        }
    }

    /**
     * 状態変更
     */
    private setState(newState: InteractionState): void {
        if (this.currentState !== newState) {
            this.currentState = newState;
            this.lastInteractionTime = Date.now();
        }
    }

    /**
     * イベントリスナーの設定
     */
    private setupEventListeners(): void {
        // ジェスチャー認識コールバック
        this.gestureRecognizer.addGestureCallback((gesture) => {
            this.handleGestureResult(gesture);
        });
    }

    /**
     * イベントの発火
     */
    private emitEvent(event: InteractionEvent): void {
        const listeners = this.eventListeners.get(event.type) || [];
        listeners.forEach((listener) => {
            try {
                listener(event);
            } catch (error) {
                console.error("Error in interaction event listener:", error);
            }
        });

        // 履歴に追加
        this.interactionHistory.events.push(event);
        if (this.interactionHistory.events.length > 1000) { // 履歴サイズ制限
            this.interactionHistory.events.shift();
        }
    }

    /**
     * インタラクション記録
     */
    private recordInteraction(gestureType: GestureType): void {
        this.interactionHistory.analytics.totalInteractions++;

        // 応答時間の記録
        const responseTime = Date.now() - this.lastInteractionTime;
        this.responseTimeBuffer.push(responseTime);

        if (this.responseTimeBuffer.length > this.MAX_RESPONSE_TIME_SAMPLES) {
            this.responseTimeBuffer.shift();
        }

        // 平均応答時間の更新
        this.interactionHistory.analytics.averageResponseTime =
            this.responseTimeBuffer.reduce((sum, time) => sum + time, 0) /
            this.responseTimeBuffer.length;
    }

    /**
     * エラー記録
     */
    private recordError(): void {
        this.interactionHistory.analytics.errorCount++;
    }

    /**
     * イベントリスナーの追加
     */
    addEventListener(
        eventType: string,
        listener: (event: InteractionEvent) => void,
    ): void {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, []);
        }
        this.eventListeners.get(eventType)!.push(listener);
    }

    /**
     * イベントリスナーの削除
     */
    removeEventListener(
        eventType: string,
        listener: (event: InteractionEvent) => void,
    ): void {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * 現在の状態を取得
     */
    getCurrentState(): InteractionState {
        return this.currentState;
    }

    /**
     * 選択されたオブジェクトを取得
     */
    getSelectedObjects(): InteractableObject[] {
        return Array.from(this.selectedObjects);
    }

    /**
     * ホバーされたオブジェクトを取得
     */
    getHoveredObjects(): InteractableObject[] {
        return Array.from(this.hoveredObjects);
    }

    /**
     * 設定の更新
     */
    updateConfig(newConfig: Partial<InteractionConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * インタラクション履歴を取得
     */
    getInteractionHistory(): InteractionHistory {
        return { ...this.interactionHistory };
    }

    /**
     * 統計情報を取得
     */
    getStats(): {
        currentState: InteractionState;
        totalInteractions: number;
        averageResponseTime: number;
        errorRate: number;
        gestureStats: any;
        raycastStats: any;
    } {
        return {
            currentState: this.currentState,
            totalInteractions:
                this.interactionHistory.analytics.totalInteractions,
            averageResponseTime:
                this.interactionHistory.analytics.averageResponseTime,
            errorRate: this.interactionHistory.analytics.errorCount /
                Math.max(
                    1,
                    this.interactionHistory.analytics.totalInteractions,
                ),
            gestureStats: this.gestureRecognizer.getAdvancedGestureStats(),
            raycastStats: this.raycastingManager.getStats(),
        };
    }

    /**
     * クリーンアップ
     */
    destroy(): void {
        this.eventListeners.clear();
        this.selectedObjects.clear();
        this.hoveredObjects.clear();
        this.dragState.clear();
        this.interactionHistory.events = [];

        console.log("InteractionManager destroyed");
    }
}
