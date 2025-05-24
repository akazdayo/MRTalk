import { Vector3 } from "three";
import {
    GestureCallback,
    GestureHistory,
    GestureResult,
    GestureType,
    XRHandPose,
} from "./types/HandTypes";

/**
 * ピンチジェスチャーの詳細情報
 */
export interface PinchGestureDetails {
    distance: number;
    force: number;
    velocity: Vector3;
    duration: number;
    startTime: number;
}

/**
 * スワイプジェスチャーの詳細情報
 */
export interface SwipeGestureDetails {
    direction: "left" | "right" | "up" | "down";
    velocity: number;
    distance: number;
    startPosition: Vector3;
    endPosition: Vector3;
    duration: number;
}

/**
 * 長押しジェスチャーの詳細情報
 */
export interface LongPressGestureDetails {
    position: Vector3;
    duration: number;
    stability: number; // 位置の安定性
}

/**
 * ジェスチャーの組み合わせ情報
 */
export interface ComboGestureDetails {
    gestures: GestureType[];
    sequence: number[];
    totalDuration: number;
    isValid: boolean;
}

/**
 * WebXRハンドトラッキングジェスチャー認識クラス
 * Rock'n rollとPoint&Tapジェスチャーを認識
 */
export class GestureRecognizer {
    private gestureHistory: GestureHistory;
    private callbacks: GestureCallback[] = [];
    private confidenceThreshold = 0.7;
    private debounceTime = 300; // ms
    private lastGestureTime = 0;

    // 高度なジェスチャー認識用の状態管理
    private pinchState: Map<string, PinchGestureDetails> = new Map();
    private swipeStartPositions: Map<
        string,
        { position: Vector3; timestamp: number }
    > = new Map();
    private longPressState: Map<
        string,
        { startTime: number; position: Vector3; isActive: boolean }
    > = new Map();
    private comboGestureBuffer: GestureType[] = [];
    private comboGestureTimeout = 2000; // ms
    private lastComboTime = 0;

    // ジェスチャー閾値設定
    private readonly PINCH_THRESHOLD = 0.03; // 3cm
    private readonly SWIPE_MIN_DISTANCE = 0.1; // 10cm
    private readonly SWIPE_MIN_VELOCITY = 0.5; // 0.5m/s
    private readonly LONG_PRESS_DURATION = 800; // ms
    private readonly POSITION_STABILITY_THRESHOLD = 0.02; // 2cm

    constructor(maxHistoryLength = 10) {
        this.gestureHistory = {
            gestures: [],
            maxHistoryLength,
        };
    }

    /**
     * ジェスチャー認識のメイン処理
     */
    recognizeGesture(
        leftHand?: XRHandPose,
        rightHand?: XRHandPose,
    ): GestureResult | null {
        const now = Date.now();

        // デバウンス処理
        if (now - this.lastGestureTime < this.debounceTime) {
            return null;
        }

        let result: GestureResult | null = null;

        // 右手のジェスチャーを優先して検出
        if (rightHand) {
            result = this.detectHandGestures(rightHand, "right");
        }

        // 右手でジェスチャーが検出されなかった場合、左手を確認
        if (!result && leftHand) {
            result = this.detectHandGestures(leftHand, "left");
        }

        if (result && result.confidence >= this.confidenceThreshold) {
            this.addToHistory(result);
            this.notifyCallbacks(result);
            this.lastGestureTime = now;
            return result;
        }

        return null;
    }

    /**
     * 単一の手のジェスチャーを検出
     */
    private detectHandGestures(
        handPose: XRHandPose,
        handedness: "left" | "right",
    ): GestureResult | null {
        // Rock'n rollジェスチャーの検出
        const rockAndRollResult = this.detectRockAndRoll(handPose);
        if (rockAndRollResult) {
            return {
                type: GestureType.ROCK_AND_ROLL,
                confidence: rockAndRollResult.confidence,
                timestamp: Date.now(),
            };
        }

        // Point&Tapジェスチャーの検出
        const pointAndTapResult = this.detectPointAndTap(handPose);
        if (pointAndTapResult.isPointing || pointAndTapResult.isTapping) {
            const type = pointAndTapResult.isTapping
                ? GestureType.TAPPING
                : GestureType.POINTING;
            return {
                type,
                confidence: pointAndTapResult.confidence,
                position: pointAndTapResult.position,
                direction: pointAndTapResult.direction,
                timestamp: Date.now(),
            };
        }

        return null;
    }

    /**
     * Rock'n rollジェスチャーの検出
     * 人差し指と小指を立て、中指と薬指を折る
     */
    detectRockAndRoll(handPose: XRHandPose): { confidence: number } | null {
        try {
            const joints = handPose.joints;

            // 必要な関節を取得
            const indexTip = this.getJointPosition(joints, "index-finger-tip");
            const indexMcp = this.getJointPosition(
                joints,
                "index-finger-metacarpal",
            );
            const middleTip = this.getJointPosition(
                joints,
                "middle-finger-tip",
            );
            const middleMcp = this.getJointPosition(
                joints,
                "middle-finger-metacarpal",
            );
            const ringTip = this.getJointPosition(joints, "ring-finger-tip");
            const ringMcp = this.getJointPosition(
                joints,
                "ring-finger-metacarpal",
            );
            const pinkyTip = this.getJointPosition(joints, "pinky-finger-tip");
            const pinkyMcp = this.getJointPosition(
                joints,
                "pinky-finger-metacarpal",
            );
            const wrist = this.getJointPosition(joints, "wrist");

            if (
                !indexTip || !indexMcp || !middleTip || !middleMcp ||
                !ringTip || !ringMcp || !pinkyTip || !pinkyMcp || !wrist
            ) {
                return null;
            }

            // 各指の伸展状態を計算
            const indexExtended = this.isFingerExtended(
                indexTip,
                indexMcp,
                wrist,
            );
            const middleFolded = !this.isFingerExtended(
                middleTip,
                middleMcp,
                wrist,
            );
            const ringFolded = !this.isFingerExtended(ringTip, ringMcp, wrist);
            const pinkyExtended = this.isFingerExtended(
                pinkyTip,
                pinkyMcp,
                wrist,
            );

            // Rock'n rollの条件をチェック
            if (indexExtended && middleFolded && ringFolded && pinkyExtended) {
                // 信頼度の計算（簡易版）
                const confidence = 0.9; // 基本信頼度
                return { confidence };
            }

            return null;
        } catch (error) {
            console.error("Error detecting rock and roll gesture:", error);
            return null;
        }
    }

    /**
     * Point&Tapジェスチャーの検出
     */
    detectPointAndTap(handPose: XRHandPose): {
        isPointing: boolean;
        isTapping: boolean;
        confidence: number;
        position?: Vector3;
        direction?: Vector3;
    } {
        try {
            const joints = handPose.joints;

            const indexTip = this.getJointPosition(joints, "index-finger-tip");
            const indexMcp = this.getJointPosition(
                joints,
                "index-finger-metacarpal",
            );
            const middleTip = this.getJointPosition(
                joints,
                "middle-finger-tip",
            );
            const middleMcp = this.getJointPosition(
                joints,
                "middle-finger-metacarpal",
            );
            const wrist = this.getJointPosition(joints, "wrist");

            if (!indexTip || !indexMcp || !middleTip || !middleMcp || !wrist) {
                return { isPointing: false, isTapping: false, confidence: 0 };
            }

            // ポイントジェスチャーの検出（人差し指が伸びて他が折れている）
            const indexExtended = this.isFingerExtended(
                indexTip,
                indexMcp,
                wrist,
            );
            const middleFolded = !this.isFingerExtended(
                middleTip,
                middleMcp,
                wrist,
            );

            if (indexExtended && middleFolded) {
                // ポイント方向を計算
                const direction = new Vector3()
                    .subVectors(indexTip, wrist)
                    .normalize();

                // タップの検出（素早い前後運動）
                const isTapping = this.detectTappingMotion(indexTip);

                return {
                    isPointing: true,
                    isTapping,
                    confidence: 0.8,
                    position: indexTip.clone(),
                    direction,
                };
            }

            return { isPointing: false, isTapping: false, confidence: 0 };
        } catch (error) {
            console.error("Error detecting point and tap gesture:", error);
            return { isPointing: false, isTapping: false, confidence: 0 };
        }
    }

    /**
     * 指が伸展しているかを判定
     */
    private isFingerExtended(
        tip: Vector3,
        mcp: Vector3,
        wrist: Vector3,
    ): boolean {
        const tipToWrist = tip.distanceTo(wrist);
        const mcpToWrist = mcp.distanceTo(wrist);

        // 指先が手首から metacarpal より遠い場合、伸展していると判定
        return tipToWrist > mcpToWrist * 1.2;
    }

    /**
     * タップ動作の検出（簡易版）
     */
    private detectTappingMotion(position: Vector3): boolean {
        // 実装では前フレームとの位置差分や速度を使用
        // ここでは簡易的にfalseを返す
        return false;
    }

    /**
     * 関節位置を取得
     */
    private getJointPosition(
        joints: Map<any, any>,
        jointName: string,
    ): Vector3 | null {
        const joint = joints.get(jointName);
        return joint ? joint.position : null;
    }

    /**
     * ジェスチャー履歴に追加
     */
    private addToHistory(gesture: GestureResult): void {
        this.gestureHistory.gestures.push(gesture);

        // 履歴の長さを制限
        if (
            this.gestureHistory.gestures.length >
                this.gestureHistory.maxHistoryLength
        ) {
            this.gestureHistory.gestures.shift();
        }
    }

    /**
     * ピンチジェスチャーの詳細検出（拡大縮小操作）
     */
    detectPinchGesture(
        handPose: XRHandPose,
        handedness: "left" | "right",
    ): PinchGestureDetails | null {
        try {
            const joints = handPose.joints;
            const thumbTip = this.getJointPosition(joints, "thumb-tip");
            const indexTip = this.getJointPosition(joints, "index-finger-tip");

            if (!thumbTip || !indexTip) {
                return null;
            }

            const distance = thumbTip.distanceTo(indexTip);
            const handKey = handedness;

            // ピンチ状態の初期化または更新
            if (!this.pinchState.has(handKey)) {
                if (distance < this.PINCH_THRESHOLD) {
                    const newPinchState: PinchGestureDetails = {
                        distance,
                        force: Math.max(
                            0,
                            (this.PINCH_THRESHOLD - distance) /
                                this.PINCH_THRESHOLD,
                        ),
                        velocity: new Vector3(),
                        duration: 0,
                        startTime: Date.now(),
                    };
                    this.pinchState.set(handKey, newPinchState);
                    return newPinchState;
                }
                return null;
            }

            const currentPinch = this.pinchState.get(handKey)!;
            const now = Date.now();

            // ピンチが継続している場合
            if (distance < this.PINCH_THRESHOLD * 1.5) {
                const deltaTime = (now - currentPinch.startTime) / 1000; // 秒
                currentPinch.duration = deltaTime;
                currentPinch.force = Math.max(
                    0,
                    (this.PINCH_THRESHOLD - distance) / this.PINCH_THRESHOLD,
                );

                // 速度計算（簡易版）
                const velocityMagnitude =
                    Math.abs(distance - currentPinch.distance) /
                    (deltaTime || 0.001);
                currentPinch.velocity.setScalar(velocityMagnitude);
                currentPinch.distance = distance;

                return currentPinch;
            } else {
                // ピンチ終了
                this.pinchState.delete(handKey);
                return null;
            }
        } catch (error) {
            console.error("Error detecting pinch gesture:", error);
            return null;
        }
    }

    /**
     * スワイプジェスチャー（メニューページング）の検出
     */
    detectSwipeGesture(
        handPose: XRHandPose,
        handedness: "left" | "right",
    ): SwipeGestureDetails | null {
        try {
            const joints = handPose.joints;
            const indexTip = this.getJointPosition(joints, "index-finger-tip");
            const wrist = this.getJointPosition(joints, "wrist");

            if (!indexTip || !wrist) {
                return null;
            }

            const handKey = handedness;
            const now = Date.now();

            // スワイプ開始位置の記録
            if (!this.swipeStartPositions.has(handKey)) {
                this.swipeStartPositions.set(handKey, {
                    position: indexTip.clone(),
                    timestamp: now,
                });
                return null;
            }

            const startData = this.swipeStartPositions.get(handKey)!;
            const deltaTime = (now - startData.timestamp) / 1000; // 秒
            const displacement = new Vector3().subVectors(
                indexTip,
                startData.position,
            );
            const distance = displacement.length();

            // 最小距離チェック
            if (distance < this.SWIPE_MIN_DISTANCE) {
                return null;
            }

            // 速度チェック
            const velocity = distance / deltaTime;
            if (velocity < this.SWIPE_MIN_VELOCITY) {
                return null;
            }

            // 方向の判定
            const direction = this.determineSwipeDirection(displacement);

            // スワイプ完了
            this.swipeStartPositions.delete(handKey);

            return {
                direction,
                velocity,
                distance,
                startPosition: startData.position.clone(),
                endPosition: indexTip.clone(),
                duration: deltaTime * 1000, // ms
            };
        } catch (error) {
            console.error("Error detecting swipe gesture:", error);
            return null;
        }
    }

    /**
     * 長押しジェスチャー（コンテキストメニュー表示）の検出
     */
    detectLongPressGesture(
        handPose: XRHandPose,
        handedness: "left" | "right",
    ): LongPressGestureDetails | null {
        try {
            const joints = handPose.joints;
            const indexTip = this.getJointPosition(joints, "index-finger-tip");

            if (!indexTip) {
                return null;
            }

            const handKey = handedness;
            const now = Date.now();

            // ポイントジェスチャーが必要
            const pointAndTap = this.detectPointAndTap(handPose);
            if (!pointAndTap.isPointing) {
                this.longPressState.delete(handKey);
                return null;
            }

            // 長押し状態の初期化または更新
            if (!this.longPressState.has(handKey)) {
                this.longPressState.set(handKey, {
                    startTime: now,
                    position: indexTip.clone(),
                    isActive: true,
                });
                return null;
            }

            const longPressData = this.longPressState.get(handKey)!;
            const duration = now - longPressData.startTime;

            // 位置の安定性チェック
            const displacement = indexTip.distanceTo(longPressData.position);
            const stability = Math.max(
                0,
                1 - (displacement / this.POSITION_STABILITY_THRESHOLD),
            );

            // 位置が不安定な場合、リセット
            if (stability < 0.5) {
                this.longPressState.delete(handKey);
                return null;
            }

            // 長押し完了チェック
            if (duration >= this.LONG_PRESS_DURATION) {
                const result: LongPressGestureDetails = {
                    position: longPressData.position.clone(),
                    duration,
                    stability,
                };

                this.longPressState.delete(handKey);
                return result;
            }

            return null;
        } catch (error) {
            console.error("Error detecting long press gesture:", error);
            return null;
        }
    }

    /**
     * ジェスチャーの組み合わせ認識
     */
    detectComboGesture(newGesture: GestureType): ComboGestureDetails | null {
        const now = Date.now();

        // タイムアウトチェック
        if (now - this.lastComboTime > this.comboGestureTimeout) {
            this.comboGestureBuffer = [];
        }

        this.comboGestureBuffer.push(newGesture);
        this.lastComboTime = now;

        // 組み合わせパターンのチェック
        const combo = this.checkComboPatterns(this.comboGestureBuffer);

        if (combo) {
            // コンボ成功時はバッファをクリア
            this.comboGestureBuffer = [];
            return combo;
        }

        // バッファサイズの制限
        if (this.comboGestureBuffer.length > 5) {
            this.comboGestureBuffer.shift();
        }

        return null;
    }

    /**
     * スワイプ方向の判定
     */
    private determineSwipeDirection(
        displacement: Vector3,
    ): "left" | "right" | "up" | "down" {
        const absX = Math.abs(displacement.x);
        const absY = Math.abs(displacement.y);

        if (absX > absY) {
            return displacement.x > 0 ? "right" : "left";
        } else {
            return displacement.y > 0 ? "up" : "down";
        }
    }

    /**
     * コンボパターンのチェック
     */
    private checkComboPatterns(
        gestures: GestureType[],
    ): ComboGestureDetails | null {
        // 例: Rock'n Roll → Point → Tap のコンボ
        if (
            gestures.length >= 3 &&
            gestures[gestures.length - 3] === GestureType.ROCK_AND_ROLL &&
            gestures[gestures.length - 2] === GestureType.POINTING &&
            gestures[gestures.length - 1] === GestureType.TAPPING
        ) {
            return {
                gestures: gestures.slice(-3),
                sequence: [0, 1, 2],
                totalDuration: this.comboGestureTimeout,
                isValid: true,
            };
        }

        // 例: 連続タップ
        if (
            gestures.length >= 2 &&
            gestures.slice(-2).every((g) => g === GestureType.TAPPING)
        ) {
            return {
                gestures: gestures.slice(-2),
                sequence: [0, 1],
                totalDuration: this.comboGestureTimeout / 2,
                isValid: true,
            };
        }

        return null;
    }

    /**
     * 高度なジェスチャー状態のクリーンアップ
     */
    cleanupAdvancedGestureStates(): void {
        const now = Date.now();

        // 古いピンチ状態を削除
        for (const [key, pinch] of this.pinchState.entries()) {
            if (now - pinch.startTime > 5000) { // 5秒でタイムアウト
                this.pinchState.delete(key);
            }
        }

        // 古いスワイプ開始位置を削除
        for (const [key, swipe] of this.swipeStartPositions.entries()) {
            if (now - swipe.timestamp > 2000) { // 2秒でタイムアウト
                this.swipeStartPositions.delete(key);
            }
        }

        // 古い長押し状態を削除
        for (const [key, longPress] of this.longPressState.entries()) {
            if (now - longPress.startTime > this.LONG_PRESS_DURATION * 2) {
                this.longPressState.delete(key);
            }
        }
    }

    /**
     * 高度なジェスチャー統計情報を取得
     */
    getAdvancedGestureStats(): {
        activePinches: number;
        activeSwipes: number;
        activeLongPresses: number;
        comboBufferSize: number;
    } {
        return {
            activePinches: this.pinchState.size,
            activeSwipes: this.swipeStartPositions.size,
            activeLongPresses: this.longPressState.size,
            comboBufferSize: this.comboGestureBuffer.length,
        };
    }
    /**
     * コールバック通知
     */
    private notifyCallbacks(gesture: GestureResult): void {
        this.callbacks.forEach((callback) => {
            try {
                callback(gesture);
            } catch (error) {
                console.error("Error in gesture callback:", error);
            }
        });
    }

    /**
     * ジェスチャーコールバックを追加
     */
    addGestureCallback(callback: GestureCallback): void {
        this.callbacks.push(callback);
    }

    /**
     * ジェスチャーコールバックを削除
     */
    removeGestureCallback(callback: GestureCallback): void {
        const index = this.callbacks.indexOf(callback);
        if (index > -1) {
            this.callbacks.splice(index, 1);
        }
    }

    /**
     * ジェスチャー履歴を取得
     */
    getGestureHistory(): GestureHistory {
        return { ...this.gestureHistory };
    }

    /**
     * 設定の更新
     */
    updateSettings(settings: {
        confidenceThreshold?: number;
        debounceTime?: number;
    }): void {
        if (settings.confidenceThreshold !== undefined) {
            this.confidenceThreshold = Math.max(
                0,
                Math.min(1, settings.confidenceThreshold),
            );
        }
        if (settings.debounceTime !== undefined) {
            this.debounceTime = Math.max(0, settings.debounceTime);
        }
    }

    /**
     * クリーンアップ
     */
    destroy(): void {
        this.callbacks = [];
        this.gestureHistory.gestures = [];

        // 高度なジェスチャー状態のクリーンアップ
        this.pinchState.clear();
        this.swipeStartPositions.clear();
        this.longPressState.clear();
        this.comboGestureBuffer = [];

        console.log("GestureRecognizer destroyed");
    }
}
