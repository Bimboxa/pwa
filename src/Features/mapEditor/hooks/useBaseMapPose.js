import { useMemo, useState, useEffect } from "react";
import clamp from "Features/misc/utils/clamp"; // Votre utilitaire existant

export default function useBaseMapPose({
    baseMap,
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

        return {
            x: bgPose.x + (basePoseInBg.x || 0) * (bgPose.k || 1),
            y: bgPose.y + (basePoseInBg.y || 0) * (bgPose.k || 1),
            k: (bgPose.k || 1) * (basePoseInBg.k || 1),
            r: (bgPose.r || 0) + (basePoseInBg.r || 0),
        };


    }, [imageSize, viewport, basePoseInBg, bgPose]);

    return { pose, imageSize };
}