import { Intersection, Object3D, Raycaster, Vector3 } from "three";
import { XRHandPose } from "../hands/types/HandTypes";

/**
 * 3D UI要素との相互作用対象
 */
export interface InteractableObject extends Object3D {
    userData: {
        type: "menu-item" | "ui-element" | "character";
        id: string;
        priority: number;
        isSelectable: boolean;
        boundingBox?: {
            min: Vector3;
            max: Vector3;
        };
    };
}

/**
 * レイキャスト結果
 */
export interface RaycastResult {
    object: InteractableObject;
    distance: number;
    point: Vector3;
    face: any;
    confidence: number;
    handedness: "left" | "right";
    timestamp: number;
}

/**
 * マルチターゲット選択結果
 */
export interface MultiTargetResult {
    primary: RaycastResult;
    secondary: RaycastResult[];
    selectionMode: "single" | "multi";
}

/**
 * レイキャスティング設定
 */
export interface RaycastingConfig {
    maxDistance: number;
    accuracyThreshold: number;
    multiSelectEnabled: boolean;
    priorityFiltering: boolean;
    confidenceThreshold: number;
}

/**
 * WebXRハンドトラッキング用レイキャスティングマネージャー
 * Three.jsのRaycasterを使用した高精度な3D UI要素との交差判定
 */
export class RaycastingManager {
    private raycaster: Raycaster;
    private interactableObjects: Set<InteractableObject> = new Set();
    private config: RaycastingConfig;
    private lastRaycastResults: Map<string, RaycastResult> = new Map();
    private selectionHistory: RaycastResult[] = [];
    private maxHistoryLength = 50;

    constructor(config?: Partial<RaycastingConfig>) {
        this.raycaster = new Raycaster();
        this.config = {
            maxDistance: 2.0,
            accuracyThreshold: 0.01,
            multiSelectEnabled: true,
            priorityFiltering: true,
            confidenceThreshold: 0.7,
            ...config,
        };

        // Raycasterの基本設定
        this.raycaster.far = this.config.maxDistance;
        this.raycaster.near = 0.1;
    }

    /**
     * 手からのレイキャスティング実行
     */
    performRaycast(
        handPose: XRHandPose,
        handedness: "left" | "right",
        origin?: Vector3,
        direction?: Vector3,
    ): RaycastResult[] {
        try {
            // レイの起点と方向を計算
            const rayData = this.calculateRayFromHand(
                handPose,
                origin,
                direction,
            );
            if (!rayData) {
                return [];
            }

            // Raycasterを設定
            this.raycaster.set(rayData.origin, rayData.direction);

            // 交差判定を実行
            const intersections = this.raycaster.intersectObjects(
                Array.from(this.interactableObjects),
                true,
            );

            // 結果を処理
            const results = this.processIntersections(
                intersections,
                handedness,
                rayData.confidence,
            );

            // 履歴に追加
            this.updateSelectionHistory(results);

            return results;
        } catch (error) {
            console.error("Error performing raycast:", error);
            return [];
        }
    }

    /**
     * マルチターゲット対応レイキャスティング
     */
    performMultiTargetRaycast(
        leftHand?: XRHandPose,
        rightHand?: XRHandPose,
    ): MultiTargetResult | null {
        const results: RaycastResult[] = [];

        // 両手からのレイキャスト
        if (rightHand) {
            results.push(...this.performRaycast(rightHand, "right"));
        }
        if (leftHand) {
            results.push(...this.performRaycast(leftHand, "left"));
        }

        if (results.length === 0) {
            return null;
        }

        // 優先度順でソート
        results.sort((a, b) => {
            if (this.config.priorityFiltering) {
                const priorityDiff = b.object.userData.priority -
                    a.object.userData.priority;
                if (priorityDiff !== 0) return priorityDiff;
            }
            return a.distance - b.distance;
        });

        const primary = results[0];
        const secondary = results.slice(1, 5); // 最大5個まで

        return {
            primary,
            secondary,
            selectionMode:
                this.config.multiSelectEnabled && secondary.length > 0
                    ? "multi"
                    : "single",
        };
    }

    /**
     * 距離ベースの選択精度向上
     */
    private calculateSelectionAccuracy(
        distance: number,
        objectSize: number,
    ): number {
        // 距離が近いほど、オブジェクトが大きいほど精度が向上
        const distanceFactor = Math.max(
            0,
            1 - (distance / this.config.maxDistance),
        );
        const sizeFactor = Math.min(1, objectSize / 0.1); // 10cm基準

        return (distanceFactor * 0.7 + sizeFactor * 0.3);
    }

    /**
     * 手の位置からレイの計算
     */
    private calculateRayFromHand(
        handPose: XRHandPose,
        customOrigin?: Vector3,
        customDirection?: Vector3,
    ): { origin: Vector3; direction: Vector3; confidence: number } | null {
        try {
            const joints = handPose.joints;

            // カスタムの起点・方向が指定されている場合
            if (customOrigin && customDirection) {
                return {
                    origin: customOrigin.clone(),
                    direction: customDirection.clone().normalize(),
                    confidence: 1.0,
                };
            }

            // 人差し指の関節を取得
            const indexTip = this.getJointPosition(joints, "index-finger-tip");
            const indexDip = this.getJointPosition(joints, "index-finger-dip");
            const indexPip = this.getJointPosition(joints, "index-finger-pip");
            const wrist = this.getJointPosition(joints, "wrist");

            if (!indexTip || !indexDip || !wrist) {
                return null;
            }

            // レイの起点（人差し指の先端）
            const origin = indexTip.clone();

            // レイの方向（人差し指の向き）
            let direction: Vector3;
            if (indexPip) {
                // より正確な指の方向を計算
                direction = new Vector3()
                    .subVectors(indexTip, indexPip)
                    .normalize();
            } else {
                // フォールバック：指先から手首への方向
                direction = new Vector3()
                    .subVectors(indexTip, wrist)
                    .normalize();
            }

            // 信頼度の計算
            const confidence = this.calculateRayConfidence(
                indexTip,
                indexDip,
                wrist,
            );

            return { origin, direction, confidence };
        } catch (error) {
            console.error("Error calculating ray from hand:", error);
            return null;
        }
    }

    /**
     * レイの信頼度計算
     */
    private calculateRayConfidence(
        indexTip: Vector3,
        indexDip: Vector3,
        wrist: Vector3,
    ): number {
        // 人差し指の直線性を評価
        const tipToWrist = new Vector3().subVectors(indexTip, wrist);
        const dipToWrist = new Vector3().subVectors(indexDip, wrist);

        const dot = tipToWrist.normalize().dot(dipToWrist.normalize());
        return Math.max(0.3, dot); // 最低30%の信頼度
    }

    /**
     * 交差判定結果の処理
     */
    private processIntersections(
        intersections: Intersection[],
        handedness: "left" | "right",
        rayConfidence: number,
    ): RaycastResult[] {
        const results: RaycastResult[] = [];
        const timestamp = Date.now();

        for (const intersection of intersections) {
            const object = intersection.object as InteractableObject;

            // インタラクト可能オブジェクトのチェック
            if (
                !this.interactableObjects.has(object) ||
                !object.userData.isSelectable
            ) {
                continue;
            }

            // 距離チェック
            if (intersection.distance > this.config.maxDistance) {
                continue;
            }

            // 精度計算
            const objectSize = this.calculateObjectSize(object);
            const selectionAccuracy = this.calculateSelectionAccuracy(
                intersection.distance,
                objectSize,
            );

            // 信頼度計算
            const confidence = Math.min(1.0, rayConfidence * selectionAccuracy);

            // 信頼度チェック
            if (confidence < this.config.confidenceThreshold) {
                continue;
            }

            const result: RaycastResult = {
                object,
                distance: intersection.distance,
                point: intersection.point.clone(),
                face: intersection.face,
                confidence,
                handedness,
                timestamp,
            };

            results.push(result);
        }

        return results;
    }

    /**
     * オブジェクトサイズの計算
     */
    private calculateObjectSize(object: InteractableObject): number {
        if (object.userData.boundingBox) {
            const size = new Vector3().subVectors(
                object.userData.boundingBox.max,
                object.userData.boundingBox.min,
            );
            return Math.max(size.x, size.y, size.z);
        }

        // デフォルトサイズ
        return 0.05; // 5cm
    }

    /**
     * 選択履歴の更新
     */
    private updateSelectionHistory(results: RaycastResult[]): void {
        this.selectionHistory.push(...results);

        // 履歴の長さを制限
        if (this.selectionHistory.length > this.maxHistoryLength) {
            this.selectionHistory = this.selectionHistory.slice(
                -this.maxHistoryLength,
            );
        }
    }

    /**
     * 関節位置を取得
     */
    private getJointPosition(
        joints: Map<any, any>,
        jointName: string,
    ): Vector3 | null {
        const joint = joints.get(jointName);
        return joint?.position || null;
    }

    /**
     * インタラクト可能オブジェクトを登録
     */
    registerInteractableObject(object: InteractableObject): void {
        this.interactableObjects.add(object);
    }

    /**
     * インタラクト可能オブジェクトを削除
     */
    unregisterInteractableObject(object: InteractableObject): void {
        this.interactableObjects.delete(object);
    }

    /**
     * すべてのインタラクト可能オブジェクトを削除
     */
    clearInteractableObjects(): void {
        this.interactableObjects.clear();
    }

    /**
     * 設定を更新
     */
    updateConfig(newConfig: Partial<RaycastingConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.raycaster.far = this.config.maxDistance;
    }

    /**
     * 選択履歴を取得
     */
    getSelectionHistory(): RaycastResult[] {
        return [...this.selectionHistory];
    }

    /**
     * 統計情報を取得
     */
    getStats(): {
        totalObjects: number;
        averageDistance: number;
        averageConfidence: number;
        selectionRate: number;
    } {
        const recentResults = this.selectionHistory.slice(-20);

        return {
            totalObjects: this.interactableObjects.size,
            averageDistance:
                recentResults.reduce((sum, r) => sum + r.distance, 0) /
                Math.max(1, recentResults.length),
            averageConfidence:
                recentResults.reduce((sum, r) => sum + r.confidence, 0) /
                Math.max(1, recentResults.length),
            selectionRate: recentResults.length / 20,
        };
    }

    /**
     * クリーンアップ
     */
    destroy(): void {
        this.interactableObjects.clear();
        this.lastRaycastResults.clear();
        this.selectionHistory = [];
        console.log("RaycastingManager destroyed");
    }
}
