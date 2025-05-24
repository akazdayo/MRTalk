import { Euler, Vector3 } from "three";
import {
    ErrorCallback,
    HandTrackingData,
    HandTrackingError,
    HandTrackingErrorInfo,
    HandTrackingEvent,
    XRHandPose,
} from "./types/HandTypes";

/**
 * WebXRハンドトラッキング管理クラス
 * WebXR Hand Tracking APIを使用してハンドトラッキングデータを管理
 */
export class HandTrackingManager {
    private xrSession: XRSession | null = null;
    private referenceSpace: any = null; // WebXR型の問題を回避
    private handTrackingData: HandTrackingData = { isTracking: false };
    private eventListeners: Map<string, Function[]> = new Map();
    private animationFrameId: number | null = null;
    private isInitialized = false;
    private errorCallback?: ErrorCallback;

    constructor(errorCallback?: ErrorCallback) {
        this.errorCallback = errorCallback;
    }

    /**
     * ハンドトラッキングシステムの初期化
     */
    async initialize(xrSession: XRSession): Promise<boolean> {
        try {
            if (!this.isWebXRHandTrackingSupported()) {
                this.handleError(
                    HandTrackingError.NOT_SUPPORTED,
                    "WebXR Hand Tracking is not supported",
                );
                return false;
            }

            this.xrSession = xrSession;

            // ReferenceSpaceを初期化時に取得して保存
            try {
                this.referenceSpace = await this.xrSession
                    .requestReferenceSpace("local");
            } catch {
                try {
                    this.referenceSpace = await this.xrSession
                        .requestReferenceSpace("viewer");
                } catch {
                    this.handleError(
                        HandTrackingError.INITIALIZATION_FAILED,
                        "Failed to get reference space",
                    );
                    return false;
                }
            }

            this.isInitialized = true;
            this.startTracking();

            console.log("HandTrackingManager initialized successfully");
            return true;
        } catch (error) {
            this.handleError(
                HandTrackingError.INITIALIZATION_FAILED,
                `Failed to initialize: ${error}`,
            );
            return false;
        }
    }

    /**
     * ハンドトラッキングの開始
     */
    private startTracking(): void {
        if (!this.xrSession || !this.isInitialized) return;

        const trackingLoop = (timestamp: number, frame: any) => {
            try {
                this.updateHandData(frame);
                this.animationFrameId = this.xrSession!.requestAnimationFrame(
                    trackingLoop,
                );
            } catch (error) {
                this.handleError(
                    HandTrackingError.TRACKING_LOST,
                    `Tracking loop error: ${error}`,
                );
            }
        };

        this.animationFrameId = this.xrSession.requestAnimationFrame(
            trackingLoop,
        );
    }

    /**
     * ハンドデータの更新
     */
    private updateHandData(frame: any): void {
        if (!this.xrSession || !this.referenceSpace) return;

        try {
            // 左手のトラッキング
            const leftHand = this.getHandPose(
                frame,
                "left",
                this.referenceSpace,
            );
            // 右手のトラッキング
            const rightHand = this.getHandPose(
                frame,
                "right",
                this.referenceSpace,
            );

            const wasTracking = this.handTrackingData.isTracking;
            const isCurrentlyTracking = leftHand !== null || rightHand !== null;

            this.handTrackingData = {
                left: leftHand || undefined,
                right: rightHand || undefined,
                isTracking: isCurrentlyTracking,
            };

            // トラッキング状態の変化を検出
            if (!wasTracking && isCurrentlyTracking) {
                this.emitEvent("tracking_recovered", this.handTrackingData);
            } else if (wasTracking && !isCurrentlyTracking) {
                this.emitEvent("tracking_lost", this.handTrackingData);
            }
        } catch (error) {
            console.error("Failed to update hand data:", error);
        }
    }

    /**
     * 手のポーズデータを取得
     */
    private getHandPose(
        frame: any,
        handedness: "left" | "right",
        referenceSpace: any,
    ): XRHandPose | null {
        try {
            const inputSource = this.findHandInputSource(handedness);
            if (!inputSource || !inputSource.hand) return null;

            const joints = new Map();
            let totalConfidence = 0;
            let jointCount = 0;

            // 各関節の位置と回転を取得
            for (const [jointName, joint] of inputSource.hand.entries()) {
                const jointPose = frame.getJointPose?.(joint, referenceSpace);
                if (jointPose) {
                    const position = new Vector3(
                        jointPose.transform.position.x,
                        jointPose.transform.position.y,
                        jointPose.transform.position.z,
                    );

                    const rotation = new Euler().setFromQuaternion({
                        x: jointPose.transform.orientation.x,
                        y: jointPose.transform.orientation.y,
                        z: jointPose.transform.orientation.z,
                        w: jointPose.transform.orientation.w,
                    } as any);

                    joints.set(jointName, {
                        position,
                        rotation,
                        radius: jointPose.radius || 0.01,
                    });

                    totalConfidence += 1.0; // 簡易的な信頼度計算
                    jointCount++;
                }
            }

            if (jointCount === 0) return null;

            return {
                joints,
                timestamp: Date.now(),
                confidence: totalConfidence / jointCount,
            };
        } catch (error) {
            console.error(`Failed to get hand pose for ${handedness}:`, error);
            return null;
        }
    }

    /**
     * 指定された手のInputSourceを検索
     */
    private findHandInputSource(handedness: "left" | "right"): any {
        if (!this.xrSession) return null;

        for (const inputSource of this.xrSession.inputSources) {
            if (inputSource.handedness === handedness && inputSource.hand) {
                return inputSource;
            }
        }
        return null;
    }

    /**
     * WebXRハンドトラッキングのサポート確認
     */
    private isWebXRHandTrackingSupported(): boolean {
        return typeof navigator !== "undefined" &&
            "xr" in navigator &&
            navigator.xr !== undefined &&
            navigator.xr !== null;
    }

    /**
     * 現在のハンドトラッキングデータを取得
     */
    getHandTrackingData(): HandTrackingData {
        return { ...this.handTrackingData };
    }

    /**
     * 現在のXRSessionを取得
     */
    getXRSession(): XRSession | null {
        return this.xrSession;
    }

    /**
     * イベントリスナーの追加
     */
    addEventListener(eventType: string, callback: Function): void {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, []);
        }
        this.eventListeners.get(eventType)!.push(callback);
    }

    /**
     * イベントリスナーの削除
     */
    removeEventListener(eventType: string, callback: Function): void {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * イベントの発火
     */
    private emitEvent(eventType: string, data: any): void {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            const event: HandTrackingEvent = {
                type: eventType as any,
                data,
                timestamp: Date.now(),
            };
            listeners.forEach((callback) => callback(event));
        }
    }

    /**
     * エラーハンドリング
     */
    private handleError(error: HandTrackingError, message: string): void {
        const errorInfo: HandTrackingErrorInfo = {
            error,
            message,
            timestamp: Date.now(),
        };

        console.error(`HandTrackingManager Error: ${message}`);

        if (this.errorCallback) {
            this.errorCallback(errorInfo);
        }
    }

    /**
     * ハンドトラッキングの停止とクリーンアップ
     */
    destroy(): void {
        if (this.animationFrameId && this.xrSession) {
            this.xrSession.cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        this.xrSession = null;
        this.referenceSpace = null;
        this.isInitialized = false;
        this.handTrackingData = { isTracking: false };
        this.eventListeners.clear();

        console.log("HandTrackingManager destroyed");
    }
}
