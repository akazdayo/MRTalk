import { useXRInputSourceEvent, useXRInputSourceState } from "@react-three/xr";

interface XRInputHandlerProps {
    onToggleChatLog: () => void;
}

export default function XRInputHandler({ onToggleChatLog }: XRInputHandlerProps) {
    const controller = useXRInputSourceState("hand", "right");

    useXRInputSourceEvent(
        controller?.inputSource,
        "selectstart",
        () => {
            onToggleChatLog();
        },
        [controller]
    );

    // このコンポーネントは何もレンダリングしない
    return null;
}