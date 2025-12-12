import clamp from "Features/misc/utils/clamp";

export default function getDefaultCameraMatrix({
    showBgImage,
    bgSize,
    baseSize,
    viewport,
    minScale = 0.001,
    maxScale = 1000,
    padding = 18,
    basePose = { x: 0, y: 0, k: 1 } // Valeur par défaut essentielle
}) {

    const W = showBgImage ? bgSize?.width : baseSize?.width;
    const H = showBgImage ? bgSize?.height : baseSize?.height;

    if (!W || !H || !viewport?.w || !viewport?.h) return { x: 0, y: 0, k: 1 };

    // 1. Calcul de la CIBLE (Où l'on veut que l'image apparaisse visuellement)
    // -----------------------------------------------------------------------

    // Espace disponible
    const availableWidth = viewport.w - padding * 2;
    const availableHeight = viewport.h - padding * 2;

    // Scale cible pour faire rentrer l'image
    const scale = Math.min(availableWidth / W, availableHeight / H) || 1;
    const targetK = clamp(scale, minScale, maxScale);

    // Position cible (Centrage + Padding)
    // Note: J'utilise ici la logique de centrage globale. 
    // Si tu veux le "padding first" vu précédemment, remplace par : padding + (availableWidth - W * targetK) / 2
    const targetX = (viewport.w - W * targetK) / 2;
    const targetY = (viewport.h - H * targetK) / 2;


    // 2. Calcul de la CAMERA (La matrice à renvoyer)
    // ----------------------------------------------

    // Cas standard : On regarde le BG (qui est en 0,0), donc Camera = Cible
    if (showBgImage) {
        return { x: targetX, y: targetY, k: targetK };
    }

    // Cas BaseMap seule (!showBgImage) : 
    // La BaseMap est DÉJÀ transformée par basePose dans le DOM.
    // Il faut compenser cette transformation dans la caméra.

    // On veut : Camera.k * basePose.k = targetK
    // Donc :
    const cameraK = targetK / (basePose.k || 1);

    // On veut : Camera.x + (Camera.k * basePose.x) = targetX
    // Donc :
    const cameraX = targetX - (cameraK * basePose.x);
    const cameraY = targetY - (cameraK * basePose.y);

    return { x: cameraX, y: cameraY, k: cameraK };

};