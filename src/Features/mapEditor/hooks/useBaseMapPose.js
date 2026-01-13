import { useMemo, useState, useEffect } from "react";
import clamp from "Features/misc/utils/clamp"; // Votre utilitaire existant

export default function useBaseMapPose({
    baseMap,
    viewport,
    basePoseInBg,
    bgPose = { x: 0, y: 0, k: 1 }
}) {
    // 1. État local pour la taille de l'image (si pas fournie par la DB)
    const imageSize = baseMap?.getImageSize();

    // 2. Le calcul (Votre logique existante)
    const pose = useMemo(() => {
        const imageSize = baseMap?.getImageSize();
        // Sécurité : Si pas de viewport ou pas d'image, on renvoie une pose par défaut
        if (!viewport.w || !viewport.h || !imageSize?.width || !imageSize?.height) {
            return { x: 0, y: 0, k: 1, r: 0 };
        }

        return {
            x: bgPose.x + (basePoseInBg.x || 0) * (bgPose.k || 1),
            y: bgPose.y + (basePoseInBg.y || 0) * (bgPose.k || 1),
            k: (bgPose.k || 1) * (basePoseInBg.k || 1),
            r: (bgPose.r || 0) + (basePoseInBg.r || 0),
        };


    }, [imageSize?.width, imageSize?.height, viewport, basePoseInBg?.k, bgPose, baseMap?.showEnhanced]);

    return { pose, imageSize };
}