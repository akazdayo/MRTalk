import { Euler, Vector3 } from "three";

/**
 * WebXR Hand Tracking API関連の型定義
 */

// ハンドトラッキングの基本型
export interface XRHandJoint {
    position: Vector3;
    rotation: Euler;
    radius: number;
}

export interface XRHandPose {
    joints: Map<XRHandJoint, XRHandJoint>;
    timestamp: number;
    confidence: number;
}

export interface HandTrackingData {
    left?: XRHandPose;
    right?: XRHandPose;
    isTracking: boolean;
}

// ジェスチャー認識関連の型
export enum GestureType {
    ROCK_AND_ROLL = "rock_and_roll",
    POINT_AND_TAP = "point_and_tap",
    POINTING = "pointing",
    TAPPING = "tapping",
    NONE = "none",
}

export interface GestureResult {
    type: GestureType;
    confidence: number;
    position?: Vector3;
    direction?: Vector3;
    timestamp: number;
}

export interface GestureHistory {
    gestures: GestureResult[];
    maxHistoryLength: number;
}

// ハンドコントローラー関連の型
export interface HandControllerState {
    isActive: boolean;
    currentGesture: GestureType;
    lastGestureTime: number;
    gestureHistory: GestureHistory;
}

export interface PointerData {
    position: Vector3;
    direction: Vector3;
    isActive: boolean;
    target?: string;
}

// メニューシステム関連の型
export interface MenuItemData {
    id: string;
    label: string;
    icon?: string;
    action: string;
    position: Vector3;
    isEnabled: boolean;
    isSelected: boolean;
}

export interface MenuState {
    isVisible: boolean;
    selectedItem: string | null;
    position: Vector3;
    rotation: Euler;
    items: MenuItemData[];
    lastUpdateTime: number;
}

export interface MenuConfiguration {
    defaultPosition: Vector3;
    fixedDistance: number;
    autoRotate: boolean;
    fadeInDuration: number;
    fadeOutDuration: number;
}

// イベント関連の型
export interface HandTrackingEvent {
    type: "gesture_detected" | "tracking_lost" | "tracking_recovered";
    data: any;
    timestamp: number;
}

export interface MenuEvent {
    type: "menu_toggled" | "item_selected" | "item_hovered";
    data: any;
    timestamp: number;
}

// エラー関連の型
export enum HandTrackingError {
    NOT_SUPPORTED = "not_supported",
    PERMISSION_DENIED = "permission_denied",
    TRACKING_LOST = "tracking_lost",
    INITIALIZATION_FAILED = "initialization_failed",
}

export interface HandTrackingErrorInfo {
    error: HandTrackingError;
    message: string;
    timestamp: number;
}

// コールバック型定義
export type GestureCallback = (gesture: GestureResult) => void;
export type MenuCallback = (event: MenuEvent) => void;
export type ErrorCallback = (error: HandTrackingErrorInfo) => void;

// ユーティリティ型
export interface Vector3Like {
    x: number;
    y: number;
    z: number;
}

export interface EulerLike {
    x: number;
    y: number;
    z: number;
    order?: string;
}
