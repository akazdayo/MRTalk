import { VRM } from "@pixiv/three-vrm";
import { Euler, Object3D, Vector3 } from "three";
import { AnimationManager } from "./AnimationManager";
import { VRMLoader } from "./VRMLoader";

/**
 * VRMキャラクターデータの型定義
 */
export interface VRMData {
    id: string;
    name: string;
    vrm: VRM;
    gltf: any;
    helperRoot: Object3D;
    personality?: string;
    story?: string;
    isFavorite?: boolean;
    isLoaded: boolean;
    animationManager?: AnimationManager;
}

/**
 * VRMキャラクターとメニューシステムの統合管理クラス
 * Phase 4: VRMとメニューの完全統合
 */
export class VRMMenuIntegration {
    private vrmLoader: VRMLoader;
    private animationManager: AnimationManager | null = null;
    private loadedVRMs: Map<string, VRMData> = new Map();
    private currentCharacterId: string | null = null;
    private menuInteractionCallbacks: Map<
        string,
        (character: VRMData) => void
    > = new Map();

    // アニメーション制御
    private idleAnimationName = "idle";
    private menuFocusAnimationName = "looking";
    private gestureSuccessAnimationName = "thinking";
    private characterIntroAnimationName = "stretch";

    // 表情制御
    private currentEmotion = "neutral";
    private emotionTransitionDuration = 0.3;

    constructor() {
        this.vrmLoader = new VRMLoader();
    }

    /**
     * VRMキャラクターのロードと初期化
     */
    async loadCharacter(
        characterId: string,
        vrmPath: string,
        characterData: any,
    ): Promise<VRMData | null> {
        try {
            console.log(
                `VRMMenuIntegration: Loading character ${characterId} from ${vrmPath}`,
            );

            // 既にロード済みの場合はキャッシュから返す
            if (this.loadedVRMs.has(characterId)) {
                const cachedVRM = this.loadedVRMs.get(characterId)!;
                console.log(
                    `VRMMenuIntegration: Using cached VRM for ${characterId}`,
                );
                return cachedVRM;
            }

            // VRMファイルをロード
            const vrmData = await this.vrmLoader.load(vrmPath);

            if (!vrmData || !vrmData.vrm) {
                console.error(
                    `VRMMenuIntegration: Failed to load VRM from ${vrmPath}`,
                );
                return null;
            }

            // AnimationManagerを初期化
            const animationManager = new AnimationManager(vrmData.gltf);

            // 基本アニメーションをロード
            await animationManager.load({
                idle: { path: "/anim/vrma/idle.vrma", isAdditive: false },
                looking: { path: "/anim/vrma/looking.vrma", isAdditive: true },
                thinking: {
                    path: "/anim/vrma/thinking.vrma",
                    isAdditive: true,
                },
                stretch: { path: "/anim/vrma/stretch.vrma", isAdditive: false },
                walk: { path: "/anim/vrma/walk.vrma", isAdditive: false },
                sit_anim: {
                    path: "/anim/vrma/sit_anim.vrma",
                    isAdditive: false,
                },
            });

            // VRMDataオブジェクトを作成
            const vrmCharacterData: VRMData = {
                id: characterId,
                name: characterData.name || "Unknown Character",
                vrm: vrmData.vrm,
                gltf: vrmData.gltf,
                helperRoot: vrmData.helperRoot,
                personality: characterData.personality,
                story: characterData.story,
                isFavorite: characterData.isFavorite || false,
                isLoaded: true,
                animationManager: animationManager,
            };

            // キャッシュに保存
            this.loadedVRMs.set(characterId, vrmCharacterData);
            this.currentCharacterId = characterId;
            this.animationManager = animationManager;

            // 初期状態設定
            await this.setCharacterToIdleState(vrmCharacterData);

            console.log(
                `VRMMenuIntegration: Successfully loaded character ${characterId}`,
            );
            return vrmCharacterData;
        } catch (error) {
            console.error(
                `VRMMenuIntegration: Error loading character ${characterId}:`,
                error,
            );
            return null;
        }
    }

    /**
     * 現在のキャラクターを取得
     */
    getCurrentCharacter(): VRMData | null {
        if (!this.currentCharacterId) return null;
        return this.loadedVRMs.get(this.currentCharacterId) || null;
    }

    /**
     * キャラクターをアイドル状態に設定
     */
    async setCharacterToIdleState(vrmData: VRMData): Promise<void> {
        if (!vrmData.animationManager) return;

        // 全てのアニメーションを停止
        vrmData.animationManager.stopAllAnimation();

        // アイドルアニメーションを開始
        vrmData.animationManager.playAnimation(this.idleAnimationName);

        // 表情をニュートラルに設定
        vrmData.animationManager.resetEmotion();
        this.currentEmotion = "neutral";

        console.log(
            `VRMMenuIntegration: Set character ${vrmData.id} to idle state`,
        );
    }

    /**
     * メニュー表示時のキャラクター注目アニメーション
     */
    async onMenuShow(menuPosition: Vector3): Promise<void> {
        const currentCharacter = this.getCurrentCharacter();
        if (!currentCharacter || !currentCharacter.animationManager) return;

        try {
            // looking アニメーションを追加で再生（アイドルは継続）
            currentCharacter.animationManager.playAnimation(
                this.menuFocusAnimationName,
            );

            // 軽い驚きの表情
            await this.setCharacterEmotion("happy", 0.3);

            // キャラクターがメニューの方向を向くようにする（VRMの lookAt 機能を使用）
            if (currentCharacter.vrm.lookAt) {
                const characterPosition = currentCharacter.gltf.scene.position;
                const lookDirection = menuPosition.clone().sub(
                    characterPosition,
                ).normalize();
                currentCharacter.vrm.lookAt.lookAt(lookDirection);
            }

            console.log("VRMMenuIntegration: Character focusing on menu");
        } catch (error) {
            console.error("VRMMenuIntegration: Error in onMenuShow:", error);
        }
    }

    /**
     * メニュー非表示時のキャラクター状態復帰
     */
    async onMenuHide(): Promise<void> {
        const currentCharacter = this.getCurrentCharacter();
        if (!currentCharacter || !currentCharacter.animationManager) return;

        try {
            // looking アニメーションを停止
            currentCharacter.animationManager.stopAnimation(
                this.menuFocusAnimationName,
            );

            // 表情をニュートラルに戻す
            await this.setCharacterEmotion("neutral");

            // 視線をリセット
            if (currentCharacter.vrm.lookAt) {
                currentCharacter.vrm.lookAt.lookAt(new Vector3(0, 0, 1));
            }

            console.log(
                "VRMMenuIntegration: Character returned to normal state",
            );
        } catch (error) {
            console.error("VRMMenuIntegration: Error in onMenuHide:", error);
        }
    }

    /**
     * ジェスチャー認識成功時の反応アニメーション
     */
    async onGestureSuccess(gestureType: string): Promise<void> {
        const currentCharacter = this.getCurrentCharacter();
        if (!currentCharacter || !currentCharacter.animationManager) return;

        try {
            // ジェスチャー成功の反応アニメーション
            currentCharacter.animationManager.playAnimation(
                this.gestureSuccessAnimationName,
            );

            // 喜びの表情
            await this.setCharacterEmotion("happy", 0.5);

            // 1.5秒後に通常状態に戻す
            setTimeout(async () => {
                currentCharacter.animationManager?.stopAnimation(
                    this.gestureSuccessAnimationName,
                );
                await this.setCharacterEmotion("neutral");
            }, 1500);

            console.log(
                `VRMMenuIntegration: Character reacted to gesture: ${gestureType}`,
            );
        } catch (error) {
            console.error(
                "VRMMenuIntegration: Error in onGestureSuccess:",
                error,
            );
        }
    }

    /**
     * キャラクター選択時の紹介アニメーション
     */
    async onCharacterSelection(characterId: string): Promise<void> {
        const character = this.loadedVRMs.get(characterId);
        if (!character || !character.animationManager) return;

        try {
            // 現在のキャラクターを変更
            this.currentCharacterId = characterId;
            this.animationManager = character.animationManager;

            // 紹介アニメーションを再生
            character.animationManager.stopAllAnimation();
            character.animationManager.playAnimation(
                this.characterIntroAnimationName,
            );

            // 挨拶の表情
            await this.setCharacterEmotion("happy", 0.7);

            // 3秒後にアイドル状態に戻す
            setTimeout(async () => {
                await this.setCharacterToIdleState(character);
            }, 3000);

            console.log(
                `VRMMenuIntegration: Character ${characterId} introduction animation started`,
            );
        } catch (error) {
            console.error(
                "VRMMenuIntegration: Error in onCharacterSelection:",
                error,
            );
        }
    }

    /**
     * キャラクターの表情を設定
     */
    async setCharacterEmotion(
        emotion: "neutral" | "happy" | "sad" | "angry",
        intensity: number = 1.0,
    ): Promise<void> {
        const currentCharacter = this.getCurrentCharacter();
        if (!currentCharacter || !currentCharacter.animationManager) return;

        try {
            // 現在の表情をリセット
            currentCharacter.animationManager.resetEmotion();

            // 新しい表情を設定
            if (emotion !== "neutral") {
                currentCharacter.animationManager.setEmotion(emotion);

                // 強度に応じて表情の強さを調整
                if (currentCharacter.vrm.expressionManager) {
                    currentCharacter.vrm.expressionManager.setValue(
                        emotion,
                        intensity,
                    );
                }
            }

            this.currentEmotion = emotion;
            console.log(
                `VRMMenuIntegration: Set emotion to ${emotion} with intensity ${intensity}`,
            );
        } catch (error) {
            console.error("VRMMenuIntegration: Error setting emotion:", error);
        }
    }

    /**
     * キャラクター情報の更新
     */
    updateCharacterData(
        characterId: string,
        updateData: Partial<any>,
    ): boolean {
        const character = this.loadedVRMs.get(characterId);
        if (!character) return false;

        try {
            // キャラクターデータを更新
            Object.assign(character, updateData);

            // メニューシステムに変更を通知
            const callback = this.menuInteractionCallbacks.get(characterId);
            if (callback) {
                callback(character);
            }

            console.log(
                `VRMMenuIntegration: Updated character data for ${characterId}`,
                updateData,
            );
            return true;
        } catch (error) {
            console.error(
                "VRMMenuIntegration: Error updating character data:",
                error,
            );
            return false;
        }
    }

    /**
     * メニューインタラクションコールバックを登録
     */
    registerMenuInteractionCallback(
        characterId: string,
        callback: (character: VRMData) => void,
    ): void {
        this.menuInteractionCallbacks.set(characterId, callback);
    }

    /**
     * キャラクターのアンロード
     */
    unloadCharacter(characterId: string): boolean {
        try {
            const character = this.loadedVRMs.get(characterId);
            if (!character) return false;

            // アニメーションを停止
            if (character.animationManager) {
                character.animationManager.stopAllAnimation();
            }

            // VRMオブジェクトをクリーンアップ
            if (character.gltf && character.gltf.scene) {
                character.gltf.scene.removeFromParent();
            }

            // キャッシュから削除
            this.loadedVRMs.delete(characterId);

            // 現在のキャラクターがアンロード対象の場合
            if (this.currentCharacterId === characterId) {
                this.currentCharacterId = null;
                this.animationManager = null;
            }

            console.log(
                `VRMMenuIntegration: Unloaded character ${characterId}`,
            );
            return true;
        } catch (error) {
            console.error(
                `VRMMenuIntegration: Error unloading character ${characterId}:`,
                error,
            );
            return false;
        }
    }

    /**
     * 全てのキャラクターをアンロード
     */
    unloadAllCharacters(): void {
        const characterIds = Array.from(this.loadedVRMs.keys());
        characterIds.forEach((id) => this.unloadCharacter(id));
    }

    /**
     * フレーム毎の更新処理
     */
    update(deltaTime: number): void {
        // 現在のキャラクターのアニメーションを更新
        if (this.animationManager) {
            this.animationManager.update();
        }

        // 全ての読み込み済みキャラクターのVRMを更新
        this.loadedVRMs.forEach((character) => {
            if (character.vrm) {
                character.vrm.update(deltaTime);
            }
        });
    }

    /**
     * デバッグ情報を取得
     */
    getDebugInfo(): any {
        return {
            loadedCharacters: Array.from(this.loadedVRMs.keys()),
            currentCharacterId: this.currentCharacterId,
            currentEmotion: this.currentEmotion,
            memoryUsage: this.loadedVRMs.size,
        };
    }

    /**
     * リソースの解放
     */
    destroy(): void {
        console.log("VRMMenuIntegration: Cleaning up resources...");

        this.unloadAllCharacters();
        this.menuInteractionCallbacks.clear();
        this.currentCharacterId = null;
        this.animationManager = null;
    }
}

// シングルトンインスタンス
let vrmMenuIntegrationInstance: VRMMenuIntegration | null = null;

/**
 * VRMMenuIntegrationのシングルトンインスタンスを取得
 */
export function getVRMMenuIntegration(): VRMMenuIntegration {
    if (!vrmMenuIntegrationInstance) {
        vrmMenuIntegrationInstance = new VRMMenuIntegration();
    }
    return vrmMenuIntegrationInstance;
}
