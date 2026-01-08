export default function fitBoundsToViewport(bounds, viewport, padding = 50) {
    if (!bounds || !viewport) return null;

    const { x, y, width, height } = bounds;
    const { w: vw, h: vh } = viewport;

    // Calcul du zoom pour faire rentrer l'objet avec du padding
    const scaleX = (vw - padding * 2) / width;
    const scaleY = (vh - padding * 2) / height;
    const k = Math.min(scaleX, scaleY); // On prend le zoom le plus petit pour que tout rentre

    // Calcul de la translation pour centrer
    // Centre Objet (World) * Zoom + Translate = Centre Viewport
    // (x + w/2) * k + tx = vw/2
    // tx = vw/2 - (x + w/2) * k
    const targetX = (vw / 2) - (x + width / 2) * k;
    const targetY = (vh / 2) - (y + height / 2) * k;

    return { x: targetX, y: targetY, k };
};