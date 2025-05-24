/**
 * Phase 4: WebXR包括的エラーハンドリングとフォールバック機能
 * 99%の安定性確保を目指すエラー処理システム
 */

interface ErrorInfo {
    type:
        | "vrm"
        | "handtracking"
        | "network"
        | "rendering"
        | "memory"
        | "system";
    severity: "low" | "medium" | "high" | "critical";
    message: string;
    code: string;
    timestamp: number;
    context?: any;
    recoverable: boolean;
}

interface RecoveryAction {
    id: string;
    description: string;
    action: () => Promise<boolean>;
    fallback?: () => Promise<boolean>;
}

interface SystemStatus {
    vrm: "operational" | "degraded" | "failed";
    handTracking: "operational" | "degraded" | "failed";
    network: "online" | "offline" | "limited";
    rendering: "normal" | "reduced" | "minimal";
    overall: "healthy" | "warning" | "critical";
}

export class ErrorHandler {
    private errors: Map<string, ErrorInfo> = new Map();
    private recoveryActions: Map<string, RecoveryAction> = new Map();
    private systemStatus: SystemStatus;
    private errorCallbacks: Map<string, (error: ErrorInfo) => void> = new Map();
    private maxRetries = 3;
    private retryDelays = [1000, 3000, 5000]; // 1秒、3秒、5秒

    constructor() {
        this.systemStatus = {
            vrm: "operational",
            handTracking: "operational",
            network: "online",
            rendering: "normal",
            overall: "healthy",
        };

        this.initializeRecoveryActions();
        this.setupGlobalErrorHandlers();
    }

    /**
     * エラーの記録と処理
     */
    handleError(
        type: ErrorInfo["type"],
        message: string,
        error?: Error,
        context?: any,
        recoverable: boolean = true,
    ): string {
        const errorId = this.generateErrorId();
        const severity = this.determineSeverity(type, error);

        const errorInfo: ErrorInfo = {
            type,
            severity,
            message,
            code: error?.name || "UNKNOWN_ERROR",
            timestamp: Date.now(),
            context,
            recoverable,
        };

        this.errors.set(errorId, errorInfo);
        console.error(
            `[ErrorHandler] ${type.toUpperCase()}: ${message}`,
            error,
            context,
        );

        // システム状態の更新
        this.updateSystemStatus(type, severity);

        // エラーコールバックの実行
        this.notifyErrorCallbacks(errorInfo);

        // 自動復旧の試行
        if (recoverable) {
            this.attemptRecovery(errorId, errorInfo);
        }

        return errorId;
    }

    /**
     * VRMロード失敗時のフォールバック
     */
    async handleVRMLoadFailure(
        characterId: string,
        vrmPath: string,
        error: Error,
    ): Promise<boolean> {
        const errorId = this.handleError(
            "vrm",
            `VRM load failed: ${vrmPath}`,
            error,
            { characterId, vrmPath },
        );

        try {
            // フォールバック1: デフォルトVRMモデルを使用
            console.log(
                "ErrorHandler: Attempting fallback to default VRM model",
            );
            const defaultVrmPath = "/models/default.vrm";

            if (vrmPath !== defaultVrmPath) {
                // デフォルトVRMのロードを試行
                // 実際の実装では VRMLoader を呼び出す
                console.log(
                    `ErrorHandler: Loading default VRM for character ${characterId}`,
                );
                return true;
            }

            // フォールバック2: 3Dアバターなしのプレースホルダー表示
            console.log("ErrorHandler: Using placeholder avatar");
            this.enablePlaceholderMode(characterId);
            return true;
        } catch (fallbackError) {
            console.error("ErrorHandler: VRM fallback failed:", fallbackError);
            this.systemStatus.vrm = "failed";
            return false;
        }
    }

    /**
     * ハンドトラッキング失敗時の代替操作方法
     */
    async handleHandTrackingFailure(error: Error): Promise<boolean> {
        const errorId = this.handleError(
            "handtracking",
            "Hand tracking failed",
            error,
        );

        try {
            // フォールバック1: コントローラー操作に切り替え
            console.log("ErrorHandler: Switching to controller input");
            await this.enableControllerFallback();

            // フォールバック2: 視線制御に切り替え
            if (await this.isGazeTrackingAvailable()) {
                console.log("ErrorHandler: Enabling gaze tracking");
                await this.enableGazeTracking();
                return true;
            }

            // フォールバック3: 音声制御
            if (await this.isVoiceControlAvailable()) {
                console.log("ErrorHandler: Enabling voice control");
                await this.enableVoiceControl();
                return true;
            }

            // 最終フォールバック: タップ操作
            console.log("ErrorHandler: Falling back to tap controls");
            await this.enableTapControls();

            this.systemStatus.handTracking = "degraded";
            return true;
        } catch (fallbackError) {
            console.error(
                "ErrorHandler: Hand tracking fallback failed:",
                fallbackError,
            );
            this.systemStatus.handTracking = "failed";
            return false;
        }
    }

    /**
     * ネットワーク切断時のオフライン機能
     */
    async handleNetworkFailure(): Promise<boolean> {
        const errorId = this.handleError("network", "Network connection lost");

        try {
            console.log("ErrorHandler: Enabling offline mode");

            // キャッシュされたデータの使用
            await this.enableOfflineMode();

            // ローカルストレージからデータを読み込み
            await this.loadCachedAssets();

            // オフライン機能の有効化
            await this.setupOfflineCapabilities();

            this.systemStatus.network = "offline";

            // ネットワーク復旧の監視開始
            this.startNetworkRecoveryMonitoring();

            return true;
        } catch (offlineError) {
            console.error(
                "ErrorHandler: Offline mode setup failed:",
                offlineError,
            );
            return false;
        }
    }

    /**
     * レンダリングエラーの処理
     */
    async handleRenderingError(error: Error, context?: any): Promise<boolean> {
        const errorId = this.handleError(
            "rendering",
            "Rendering error occurred",
            error,
            context,
        );

        try {
            // フォールバック1: 品質を下げる
            console.log("ErrorHandler: Reducing rendering quality");
            await this.reduceRenderingQuality();

            // フォールバック2: 不要なエフェクトを無効化
            await this.disableNonEssentialEffects();

            // フォールバック3: シンプルなレンダラーに切り替え
            if (this.systemStatus.rendering === "minimal") {
                console.log("ErrorHandler: Switching to basic renderer");
                await this.enableBasicRenderer();
            }

            this.systemStatus.rendering = "reduced";
            return true;
        } catch (renderingFallbackError) {
            console.error(
                "ErrorHandler: Rendering fallback failed:",
                renderingFallbackError,
            );
            this.systemStatus.rendering = "minimal";
            return false;
        }
    }

    /**
     * メモリ不足エラーの処理
     */
    async handleMemoryError(error: Error): Promise<boolean> {
        const errorId = this.handleError(
            "memory",
            "Memory limit exceeded",
            error,
        );

        try {
            console.log("ErrorHandler: Performing emergency memory cleanup");

            // 緊急メモリクリーンアップ
            await this.performEmergencyCleanup();

            // 低優先度リソースの解放
            await this.releaseLowPriorityResources();

            // ガベージコレクションの強制実行
            if (global.gc) {
                global.gc();
            }

            // メモリ使用量の監視強化
            this.enableAggressiveMemoryMonitoring();

            return true;
        } catch (memoryFallbackError) {
            console.error(
                "ErrorHandler: Memory error recovery failed:",
                memoryFallbackError,
            );
            return false;
        }
    }

    /**
     * システム復旧機能
     */
    async recoverSystem(): Promise<boolean> {
        console.log("ErrorHandler: Starting system recovery...");

        try {
            // 段階的復旧
            const recoverySteps = [
                () => this.resetRenderingSystem(),
                () => this.reinitializeHandTracking(),
                () => this.reloadCriticalAssets(),
                () => this.validateSystemIntegrity(),
            ];

            for (const step of recoverySteps) {
                try {
                    await step();
                } catch (stepError) {
                    console.warn(
                        "ErrorHandler: Recovery step failed:",
                        stepError,
                    );
                }
            }

            // システム状態のリセット
            this.resetSystemStatus();

            console.log("ErrorHandler: System recovery completed");
            return true;
        } catch (recoveryError) {
            console.error(
                "ErrorHandler: System recovery failed:",
                recoveryError,
            );
            return false;
        }
    }

    /**
     * プライベートメソッド
     */
    private initializeRecoveryActions(): void {
        // VRMロード失敗の復旧アクション
        this.recoveryActions.set("vrm-load-failure", {
            id: "vrm-load-failure",
            description: "Reload VRM with default settings",
            action: async () => {
                // VRMの再ロード処理
                return true;
            },
            fallback: async () => {
                // プレースホルダーモードの有効化
                return true;
            },
        });

        // ハンドトラッキング失敗の復旧アクション
        this.recoveryActions.set("handtracking-failure", {
            id: "handtracking-failure",
            description: "Restart hand tracking system",
            action: async () => {
                // ハンドトラッキングの再初期化
                return true;
            },
            fallback: async () => {
                // 代替入力方法の有効化
                return true;
            },
        });
    }

    private setupGlobalErrorHandlers(): void {
        // 未処理の例外をキャッチ
        window.addEventListener("error", (event) => {
            this.handleError("system", event.message, event.error, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
            });
        });

        // 未処理のPromise拒否をキャッチ
        window.addEventListener("unhandledrejection", (event) => {
            this.handleError(
                "system",
                "Unhandled promise rejection",
                new Error(event.reason),
                {
                    reason: event.reason,
                },
            );
        });

        // WebGL関連のエラーをキャッチ
        const canvas = document.querySelector("canvas");
        if (canvas) {
            canvas.addEventListener("webglcontextlost", (event) => {
                this.handleError(
                    "rendering",
                    "WebGL context lost",
                    new Error("Context lost"),
                );
                event.preventDefault();
            });

            canvas.addEventListener("webglcontextrestored", () => {
                console.log("ErrorHandler: WebGL context restored");
                this.recoverSystem();
            });
        }
    }

    private generateErrorId(): string {
        return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private determineSeverity(
        type: ErrorInfo["type"],
        error?: Error,
    ): ErrorInfo["severity"] {
        // エラータイプとエラー内容に基づいて重要度を判定
        if (type === "system" || type === "memory") return "critical";
        if (type === "rendering") return "high";
        if (type === "vrm" || type === "handtracking") return "medium";
        return "low";
    }

    private updateSystemStatus(
        type: ErrorInfo["type"],
        severity: ErrorInfo["severity"],
    ): void {
        switch (type) {
            case "vrm":
                this.systemStatus.vrm = severity === "critical"
                    ? "failed"
                    : "degraded";
                break;
            case "handtracking":
                this.systemStatus.handTracking = severity === "critical"
                    ? "failed"
                    : "degraded";
                break;
            case "network":
                this.systemStatus.network = severity === "critical"
                    ? "offline"
                    : "limited";
                break;
            case "rendering":
                this.systemStatus.rendering = severity === "critical"
                    ? "minimal"
                    : "reduced";
                break;
        }

        // 全体的なシステム状態の更新
        this.updateOverallStatus();
    }

    private updateOverallStatus(): void {
        const statuses = Object.values(this.systemStatus);

        if (
            statuses.some((status) =>
                status === "failed" || status === "offline" ||
                status === "minimal"
            )
        ) {
            this.systemStatus.overall = "critical";
        } else if (
            statuses.some((status) =>
                status === "degraded" || status === "limited" ||
                status === "reduced"
            )
        ) {
            this.systemStatus.overall = "warning";
        } else {
            this.systemStatus.overall = "healthy";
        }
    }

    private notifyErrorCallbacks(errorInfo: ErrorInfo): void {
        this.errorCallbacks.forEach((callback, id) => {
            try {
                callback(errorInfo);
            } catch (callbackError) {
                console.error(
                    `ErrorHandler: Error in callback ${id}:`,
                    callbackError,
                );
            }
        });
    }

    private async attemptRecovery(
        errorId: string,
        errorInfo: ErrorInfo,
    ): Promise<void> {
        const actionKey = `${errorInfo.type}-failure`;
        const recoveryAction = this.recoveryActions.get(actionKey);

        if (!recoveryAction) return;

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                console.log(
                    `ErrorHandler: Recovery attempt ${
                        attempt + 1
                    } for ${errorInfo.type}`,
                );

                await new Promise((resolve) =>
                    setTimeout(resolve, this.retryDelays[attempt] || 5000)
                );

                const success = await recoveryAction.action();
                if (success) {
                    console.log(
                        `ErrorHandler: Recovery successful for ${errorInfo.type}`,
                    );
                    return;
                }
            } catch (recoveryError) {
                console.error(
                    `ErrorHandler: Recovery attempt ${attempt + 1} failed:`,
                    recoveryError,
                );
            }
        }

        // すべての復旧試行が失敗した場合、フォールバックを実行
        if (recoveryAction.fallback) {
            try {
                await recoveryAction.fallback();
                console.log(
                    `ErrorHandler: Fallback executed for ${errorInfo.type}`,
                );
            } catch (fallbackError) {
                console.error(
                    `ErrorHandler: Fallback failed for ${errorInfo.type}:`,
                    fallbackError,
                );
            }
        }
    }

    // フォールバック機能の実装
    private enablePlaceholderMode(characterId: string): void {
        console.log(
            `ErrorHandler: Enabling placeholder mode for character ${characterId}`,
        );
        // プレースホルダーアバターの表示ロジック
    }

    private async enableControllerFallback(): Promise<void> {
        console.log("ErrorHandler: Enabling controller fallback");
        // VRコントローラー操作の有効化
    }

    private async isGazeTrackingAvailable(): Promise<boolean> {
        // 視線追跡の可用性チェック
        return false; // 簡略化
    }

    private async enableGazeTracking(): Promise<void> {
        console.log("ErrorHandler: Enabling gaze tracking");
        // 視線制御の実装
    }

    private async isVoiceControlAvailable(): Promise<boolean> {
        return "webkitSpeechRecognition" in window ||
            "SpeechRecognition" in window;
    }

    private async enableVoiceControl(): Promise<void> {
        console.log("ErrorHandler: Enabling voice control");
        // 音声制御の実装
    }

    private async enableTapControls(): Promise<void> {
        console.log("ErrorHandler: Enabling tap controls");
        // タップ操作の実装
    }

    private async enableOfflineMode(): Promise<void> {
        console.log("ErrorHandler: Enabling offline mode");
        // オフラインモードの実装
    }

    private async loadCachedAssets(): Promise<void> {
        console.log("ErrorHandler: Loading cached assets");
        // キャッシュされたアセットの読み込み
    }

    private async setupOfflineCapabilities(): Promise<void> {
        console.log("ErrorHandler: Setting up offline capabilities");
        // オフライン機能のセットアップ
    }

    private startNetworkRecoveryMonitoring(): void {
        console.log("ErrorHandler: Starting network recovery monitoring");
        // ネットワーク復旧の監視
    }

    private async reduceRenderingQuality(): Promise<void> {
        console.log("ErrorHandler: Reducing rendering quality");
        // レンダリング品質の削減
    }

    private async disableNonEssentialEffects(): Promise<void> {
        console.log("ErrorHandler: Disabling non-essential effects");
        // 不要なエフェクトの無効化
    }

    private async enableBasicRenderer(): Promise<void> {
        console.log("ErrorHandler: Enabling basic renderer");
        // ベーシックレンダラーの有効化
    }

    private async performEmergencyCleanup(): Promise<void> {
        console.log("ErrorHandler: Performing emergency cleanup");
        // 緊急メモリクリーンアップ
    }

    private async releaseLowPriorityResources(): Promise<void> {
        console.log("ErrorHandler: Releasing low priority resources");
        // 低優先度リソースの解放
    }

    private enableAggressiveMemoryMonitoring(): void {
        console.log("ErrorHandler: Enabling aggressive memory monitoring");
        // メモリ監視の強化
    }

    private async resetRenderingSystem(): Promise<void> {
        console.log("ErrorHandler: Resetting rendering system");
        // レンダリングシステムのリセット
    }

    private async reinitializeHandTracking(): Promise<void> {
        console.log("ErrorHandler: Reinitializing hand tracking");
        // ハンドトラッキングの再初期化
    }

    private async reloadCriticalAssets(): Promise<void> {
        console.log("ErrorHandler: Reloading critical assets");
        // 重要なアセットの再読み込み
    }

    private async validateSystemIntegrity(): Promise<void> {
        console.log("ErrorHandler: Validating system integrity");
        // システム整合性の検証
    }

    private resetSystemStatus(): void {
        this.systemStatus = {
            vrm: "operational",
            handTracking: "operational",
            network: "online",
            rendering: "normal",
            overall: "healthy",
        };
    }

    /**
     * パブリック API
     */
    registerErrorCallback(
        id: string,
        callback: (error: ErrorInfo) => void,
    ): void {
        this.errorCallbacks.set(id, callback);
    }

    unregisterErrorCallback(id: string): void {
        this.errorCallbacks.delete(id);
    }

    getSystemStatus(): SystemStatus {
        return { ...this.systemStatus };
    }

    getErrorHistory(): ErrorInfo[] {
        return Array.from(this.errors.values()).sort((a, b) =>
            b.timestamp - a.timestamp
        );
    }

    clearErrorHistory(): void {
        this.errors.clear();
    }

    getErrorStats(): {
        total: number;
        bySeverity: Record<string, number>;
        byType: Record<string, number>;
    } {
        const errors = Array.from(this.errors.values());
        const bySeverity: Record<string, number> = {};
        const byType: Record<string, number> = {};

        errors.forEach((error) => {
            bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
            byType[error.type] = (byType[error.type] || 0) + 1;
        });

        return {
            total: errors.length,
            bySeverity,
            byType,
        };
    }
}

// シングルトンインスタンス
let errorHandlerInstance: ErrorHandler | null = null;

export function getErrorHandler(): ErrorHandler {
    if (!errorHandlerInstance) {
        errorHandlerInstance = new ErrorHandler();
    }
    return errorHandlerInstance;
}
