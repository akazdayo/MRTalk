/**
 * Phase 4: WebXRメモリ管理最適化システム
 * VRMモデルとテクスチャの効率的な管理
 */
import { BufferGeometry, Material, Object3D, Texture } from "three";
import { VRM } from "@pixiv/three-vrm";

interface MemoryResource {
    id: string;
    type: "vrm" | "texture" | "material" | "geometry" | "audio";
    size: number;
    lastAccessed: number;
    priority: "low" | "medium" | "high" | "critical";
    inUse: boolean;
    resourceRef: any;
}

interface MemoryStats {
    totalAllocated: number;
    totalUsed: number;
    totalCached: number;
    vrmMemory: number;
    textureMemory: number;
    geometryMemory: number;
    fragmentationRatio: number;
}

export class MemoryManager {
    private resources: Map<string, MemoryResource> = new Map();
    private cache: Map<string, any> = new Map();
    private maxMemoryLimit: number = 200 * 1024 * 1024; // 200MB
    private gcThreshold: number = 0.8; // 80%でGC実行
    private textureCache: Map<string, Texture> = new Map();
    private vrmCache: Map<string, { vrm: VRM; gltf: any }> = new Map();

    // メモリプール
    private geometryPool: Map<string, BufferGeometry[]> = new Map();
    private materialPool: Map<string, Material[]> = new Map();

    constructor(maxMemoryMB: number = 200) {
        this.maxMemoryLimit = maxMemoryMB * 1024 * 1024;
        this.startMemoryMonitoring();
    }

    /**
     * リソースの登録
     */
    registerResource(
        id: string,
        type: MemoryResource["type"],
        resource: any,
        priority: MemoryResource["priority"] = "medium",
    ): void {
        const size = this.calculateResourceSize(resource, type);

        const memoryResource: MemoryResource = {
            id,
            type,
            size,
            lastAccessed: Date.now(),
            priority,
            inUse: true,
            resourceRef: resource,
        };

        this.resources.set(id, memoryResource);
        console.log(
            `MemoryManager: Registered ${type} resource ${id} (${
                this.formatBytes(size)
            })`,
        );

        // メモリ制限チェック
        this.checkMemoryLimit();
    }

    /**
     * リソースの取得
     */
    getResource<T = any>(id: string): T | null {
        const resource = this.resources.get(id);
        if (resource) {
            resource.lastAccessed = Date.now();
            resource.inUse = true;
            return resource.resourceRef as T;
        }

        // キャッシュから取得を試行
        return this.cache.get(id) || null;
    }

    /**
     * VRMモデルの効率的ロード・アンロード
     */
    async loadVRMModel(
        id: string,
        url: string,
    ): Promise<{ vrm: VRM; gltf: any } | null> {
        // キャッシュから確認
        if (this.vrmCache.has(id)) {
            const cached = this.vrmCache.get(id)!;
            this.registerResource(id, "vrm", cached, "high");
            return cached;
        }

        try {
            // ここで実際のVRMロード処理を実行
            // 簡略化のため、実装は省略
            console.log(`MemoryManager: Loading VRM ${id} from ${url}`);

            // メモリ不足の場合は低優先度リソースを解放
            if (this.shouldFreeMemory()) {
                await this.freeUnusedResources();
            }

            return null; // 実装省略
        } catch (error) {
            console.error(`MemoryManager: Failed to load VRM ${id}:`, error);
            return null;
        }
    }

    /**
     * VRMモデルのアンロード
     */
    unloadVRMModel(id: string): boolean {
        const resource = this.resources.get(id);
        if (!resource || resource.type !== "vrm") return false;

        try {
            // VRMリソースのクリーンアップ
            if (resource.resourceRef?.vrm) {
                this.cleanupVRM(resource.resourceRef.vrm);
            }

            // GLTFシーンのクリーンアップ
            if (resource.resourceRef?.gltf?.scene) {
                this.cleanupObject3D(resource.resourceRef.gltf.scene);
            }

            this.resources.delete(id);
            this.vrmCache.delete(id);

            console.log(`MemoryManager: Unloaded VRM ${id}`);
            return true;
        } catch (error) {
            console.error(`MemoryManager: Error unloading VRM ${id}:`, error);
            return false;
        }
    }

    /**
     * テクスチャキャッシュシステム
     */
    cacheTexture(id: string, texture: Texture): void {
        // 既存のテクスチャを解放
        if (this.textureCache.has(id)) {
            const oldTexture = this.textureCache.get(id)!;
            oldTexture.dispose();
        }

        this.textureCache.set(id, texture);
        this.registerResource(id, "texture", texture, "medium");
    }

    getTextureFromCache(id: string): Texture | null {
        return this.textureCache.get(id) || null;
    }

    /**
     * 自動ガベージコレクション
     */
    async performGarbageCollection(): Promise<void> {
        console.log("MemoryManager: Starting garbage collection...");

        const beforeStats = this.getMemoryStats();

        // 使用されていないリソースを特定
        const unusedResources = Array.from(this.resources.entries())
            .filter(([_, resource]) =>
                !resource.inUse && this.isResourceExpired(resource)
            )
            .sort((a, b) => {
                // 優先度と最終アクセス時間でソート
                const priorityOrder = {
                    low: 0,
                    medium: 1,
                    high: 2,
                    critical: 3,
                };
                if (
                    priorityOrder[a[1].priority] !==
                        priorityOrder[b[1].priority]
                ) {
                    return priorityOrder[a[1].priority] -
                        priorityOrder[b[1].priority];
                }
                return a[1].lastAccessed - b[1].lastAccessed;
            });

        // リソースを段階的に解放
        let freedMemory = 0;
        for (const [id, resource] of unusedResources) {
            if (freedMemory > this.maxMemoryLimit * 0.3) break; // 30%解放したら停止

            if (await this.disposeResource(id, resource)) {
                freedMemory += resource.size;
            }
        }

        // JavaScriptのガベージコレクションを促進
        if (global.gc) {
            global.gc();
        }

        const afterStats = this.getMemoryStats();
        console.log(
            `MemoryManager: GC completed. Freed ${
                this.formatBytes(freedMemory)
            }`,
        );
        console.log(
            `MemoryManager: Memory usage: ${
                this.formatBytes(beforeStats.totalUsed)
            } → ${this.formatBytes(afterStats.totalUsed)}`,
        );
    }

    /**
     * メモリリーク検出・防止
     */
    detectMemoryLeaks(): Array<{ id: string; suspiciousActivity: string }> {
        const leaks: Array<{ id: string; suspiciousActivity: string }> = [];
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;

        this.resources.forEach((resource, id) => {
            // 1時間以上アクセスされていないリソース
            if (resource.lastAccessed < oneHourAgo && resource.inUse) {
                leaks.push({
                    id,
                    suspiciousActivity:
                        "Resource not accessed for over 1 hour but still marked as in use",
                });
            }

            // 異常に大きなリソース
            if (resource.size > 50 * 1024 * 1024) { // 50MB
                leaks.push({
                    id,
                    suspiciousActivity: `Unusually large resource size: ${
                        this.formatBytes(resource.size)
                    }`,
                });
            }
        });

        return leaks;
    }

    /**
     * メモリ使用量統計の取得
     */
    getMemoryStats(): MemoryStats {
        let totalAllocated = 0;
        let totalUsed = 0;
        let vrmMemory = 0;
        let textureMemory = 0;
        let geometryMemory = 0;

        this.resources.forEach((resource) => {
            totalAllocated += resource.size;
            if (resource.inUse) {
                totalUsed += resource.size;
            }

            switch (resource.type) {
                case "vrm":
                    vrmMemory += resource.size;
                    break;
                case "texture":
                    textureMemory += resource.size;
                    break;
                case "geometry":
                    geometryMemory += resource.size;
                    break;
            }
        });

        const totalCached = this.cache.size * 1024; // 簡易計算
        const fragmentationRatio = totalAllocated > 0
            ? (totalAllocated - totalUsed) / totalAllocated
            : 0;

        return {
            totalAllocated,
            totalUsed,
            totalCached,
            vrmMemory,
            textureMemory,
            geometryMemory,
            fragmentationRatio,
        };
    }

    /**
     * プライベートメソッド
     */
    private calculateResourceSize(
        resource: any,
        type: MemoryResource["type"],
    ): number {
        switch (type) {
            case "vrm":
                return this.calculateVRMSize(resource);
            case "texture":
                return this.calculateTextureSize(resource);
            case "geometry":
                return this.calculateGeometrySize(resource);
            case "material":
                return this.calculateMaterialSize(resource);
            default:
                return 1024; // デフォルト1KB
        }
    }

    private calculateVRMSize(vrm: any): number {
        let size = 0;

        // VRMの基本サイズ
        size += 1024 * 1024; // 1MB baseline

        // テクスチャサイズを加算
        if (vrm.gltf?.scene) {
            vrm.gltf.scene.traverse((object: Object3D) => {
                if (object.type === "Mesh") {
                    const mesh = object as any;
                    if (mesh.material) {
                        size += this.calculateMaterialSize(mesh.material);
                    }
                    if (mesh.geometry) {
                        size += this.calculateGeometrySize(mesh.geometry);
                    }
                }
            });
        }

        return size;
    }

    private calculateTextureSize(texture: Texture): number {
        if (!texture.image) return 1024;

        const width = texture.image.width || 512;
        const height = texture.image.height || 512;
        const channels = 4; // RGBA

        return width * height * channels;
    }

    private calculateGeometrySize(geometry: BufferGeometry): number {
        let size = 0;

        Object.values(geometry.attributes).forEach((attribute) => {
            size += attribute.array.byteLength;
        });

        if (geometry.index) {
            size += geometry.index.array.byteLength;
        }

        return size;
    }

    private calculateMaterialSize(material: Material): number {
        let size = 1024; // 基本サイズ

        // マテリアルのテクスチャを考慮
        Object.values(material).forEach((value) => {
            if (value && value.isTexture) {
                size += this.calculateTextureSize(value as Texture);
            }
        });

        return size;
    }

    private cleanupVRM(vrm: VRM): void {
        // VRMの表情管理をクリーンアップ
        if (vrm.expressionManager) {
            // VRMExpressionManagerには destroy メソッドがないため、
            // 手動でリソースをクリーンアップ
            try {
                // 表情の値をリセット
                const expressions = [
                    "neutral",
                    "happy",
                    "sad",
                    "angry",
                    "surprised",
                    "blink",
                ];
                expressions.forEach((expr) => {
                    try {
                        vrm.expressionManager?.setValue(expr, 0);
                    } catch (e) {
                        // 存在しない表情の場合は無視
                    }
                });
            } catch (error) {
                console.warn("Failed to cleanup VRM expressions:", error);
            }
        }

        // VRMの視線制御をクリーンアップ
        if (vrm.lookAt) {
            // lookAtのクリーンアップ（必要に応じて）
            try {
                vrm.lookAt.target = null;
            } catch (error) {
                console.warn("Failed to cleanup VRM lookAt:", error);
            }
        }

        // その他VRM固有のリソースをクリーンアップ
    }

    private cleanupObject3D(object: Object3D): void {
        object.traverse((child) => {
            if (child.type === "Mesh") {
                const mesh = child as any;

                // ジオメトリの解放
                if (mesh.geometry) {
                    mesh.geometry.dispose();
                }

                // マテリアルの解放
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach((material: Material) =>
                            material.dispose()
                        );
                    } else {
                        mesh.material.dispose();
                    }
                }
            }
        });

        // オブジェクトをシーンから削除
        object.removeFromParent();
    }

    private shouldFreeMemory(): boolean {
        const stats = this.getMemoryStats();
        return stats.totalUsed / this.maxMemoryLimit > this.gcThreshold;
    }

    private async freeUnusedResources(): Promise<void> {
        const unusedResources = Array.from(this.resources.entries())
            .filter(([_, resource]) => !resource.inUse)
            .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

        // 最も古いリソースから10個まで解放
        for (let i = 0; i < Math.min(10, unusedResources.length); i++) {
            const [id, resource] = unusedResources[i];
            await this.disposeResource(id, resource);
        }
    }

    private isResourceExpired(resource: MemoryResource): boolean {
        const now = Date.now();
        const expirationTime = {
            low: 5 * 60 * 1000, // 5分
            medium: 15 * 60 * 1000, // 15分
            high: 60 * 60 * 1000, // 1時間
            critical: 0, // 期限切れなし
        }[resource.priority];

        return expirationTime > 0 &&
            (now - resource.lastAccessed) > expirationTime;
    }

    private async disposeResource(
        id: string,
        resource: MemoryResource,
    ): Promise<boolean> {
        try {
            switch (resource.type) {
                case "vrm":
                    return this.unloadVRMModel(id);
                case "texture":
                    const texture = resource.resourceRef as Texture;
                    texture.dispose();
                    break;
                case "geometry":
                    const geometry = resource.resourceRef as BufferGeometry;
                    geometry.dispose();
                    break;
                case "material":
                    const material = resource.resourceRef as Material;
                    material.dispose();
                    break;
            }

            this.resources.delete(id);
            this.cache.delete(id);
            return true;
        } catch (error) {
            console.error(
                `MemoryManager: Error disposing resource ${id}:`,
                error,
            );
            return false;
        }
    }

    private checkMemoryLimit(): void {
        if (this.shouldFreeMemory()) {
            console.warn(
                "MemoryManager: Memory limit exceeded, triggering garbage collection",
            );
            setTimeout(() => this.performGarbageCollection(), 0);
        }
    }

    private startMemoryMonitoring(): void {
        setInterval(() => {
            const stats = this.getMemoryStats();
            const usagePercent = (stats.totalUsed / this.maxMemoryLimit) * 100;

            if (usagePercent > 70) {
                console.warn(
                    `MemoryManager: High memory usage: ${
                        usagePercent.toFixed(1)
                    }%`,
                );
            }

            // メモリリーク検出
            const leaks = this.detectMemoryLeaks();
            if (leaks.length > 0) {
                console.warn(
                    "MemoryManager: Potential memory leaks detected:",
                    leaks,
                );
            }
        }, 30000); // 30秒ごと
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return "0 Bytes";

        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    /**
     * デバッグ情報の取得
     */
    getDebugInfo(): any {
        const stats = this.getMemoryStats();
        const leaks = this.detectMemoryLeaks();

        return {
            stats,
            resourceCount: this.resources.size,
            cacheSize: this.cache.size,
            memoryLeaks: leaks,
            memoryPressure: (stats.totalUsed / this.maxMemoryLimit) * 100,
        };
    }

    /**
     * リソースの解放
     */
    dispose(): void {
        console.log("MemoryManager: Disposing all resources...");

        this.resources.forEach((resource, id) => {
            this.disposeResource(id, resource);
        });

        this.resources.clear();
        this.cache.clear();
        this.textureCache.clear();
        this.vrmCache.clear();
        this.geometryPool.clear();
        this.materialPool.clear();
    }
}

// シングルトンインスタンス
let memoryManagerInstance: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
    if (!memoryManagerInstance) {
        memoryManagerInstance = new MemoryManager();
    }
    return memoryManagerInstance;
}
