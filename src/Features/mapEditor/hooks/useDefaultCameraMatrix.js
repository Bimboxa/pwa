import clamp from "Features/misc/utils/clamp";

export default function useDefaultCameraMatrix({
    showBgImage,
    bgSize,
    baseSize,
    viewport,
    minScale = 0.001,
    maxScale = 1000,
    padding = 18
}) {

    const W = showBgImage ? bgSize?.width : baseSize?.width;
    const H = showBgImage ? bgSize?.height : baseSize?.height;

    if (!W || !H || !viewport?.w || !viewport?.h) return { x: 0, y: 0, k: 1 };

    // If not showing bg image, calculate scale to fit with padding
    if (!showBgImage) {
        return { x: 0, y: 0, k: 1 };
    }

    // Calculate available space after padding
    const availableWidth = viewport.w - padding * 2;
    const availableHeight = viewport.h - padding * 2;

    const scale = Math.min(availableWidth / W, availableHeight / H) || 1;
    const k = clamp(scale, minScale, maxScale);
    const x = (viewport.w - W * k) / 2;
    const y = (viewport.h - H * k) / 2;

    return { x, y, k };

};