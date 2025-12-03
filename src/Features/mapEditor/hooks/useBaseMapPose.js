import { useMemo, useState, useEffect } from "react";
import clamp from "Features/misc/utils/clamp"; // Votre utilitaire existant

export default function useBaseMapPose({
    baseMap,
    showBgImage,
    viewport,
    basePoseInBg,
    bgPose = { x: 0, y: 0, k: 1 }
}) {
    // 1. État local pour la taille de l'image (si pas fournie par la DB)
    const [imageSize, setImageSize] = useState({ w: 0, h: 0 });

    // Charger la taille de l'image si nécessaire
    useEffect(() => {
        const url = baseMap?.getUrl();
        const imageSize = baseMap?.getImageSize();

        if (!url) return;

        // Si vous avez déjà la taille en DB, utilisez-la directement et skippez ce useEffect
        if (imageSize) {
            setImageSize({ w: imageSize.width, h: imageSize.height });
            return;
        }

        const img = new Image();
        img.onload = () => setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
        img.src = url;
    }, [baseMap?.getUrl()]);

    // 2. Le calcul (Votre logique existante)
    const pose = useMemo(() => {
        // Sécurité : Si pas de viewport ou pas d'image, on renvoie une pose par défaut
        if (!viewport.w || !viewport.h || !imageSize.w || !imageSize.h) {
            return { x: 0, y: 0, k: 1, r: 0 };
        }

        if (!showBgImage) {
            const PADDING = 15;
            const minScale = 0.01;
            const maxScale = 50;

            const availableWidth = viewport.w - PADDING * 2;
            const availableHeight = viewport.h - PADDING * 2;

            const scale = Math.min(
                availableWidth / imageSize.w,
                availableHeight / imageSize.h
            );

            const k = clamp(scale, minScale, maxScale);
            const x = (viewport.w - imageSize.w * k) / 2;
            const y = (viewport.h - imageSize.h * k) / 2;

            return { x, y, k, r: 0 };
        } else {
            return {
                x: bgPose.x + (basePoseInBg.x || 0) * (bgPose.k || 1),
                y: bgPose.y + (basePoseInBg.y || 0) * (bgPose.k || 1),
                k: (bgPose.k || 1) * (basePoseInBg.k || 1),
                r: (bgPose.r || 0) + (basePoseInBg.r || 0),
            };
        }
    }, [showBgImage, imageSize, viewport, basePoseInBg, bgPose]);

    return { pose, imageSize };
}