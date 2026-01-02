// self.importScripts("./utils/loadImageDataFromUrl.js");

async function extendLineAsync({ msg, payload }) {
    try {
        const {
            imageUrl,
            points,
            delta, // Nouveau paramètre : { variant: "MANUAL" | "AUTO", value: number, direction: "TOP"|"BOTTOM"|"LEFT"|"RIGHT" }
            stepSize = 2,
            searchRadius = 15,
            maxGap = 10,
            darkThreshold = 100
        } = payload || {};

        if (!imageUrl) throw new Error("imageUrl is required");
        if (!points || points.length !== 2) throw new Error("points array of length 2 is required");

        const imageData = await loadImageDataFromUrl(imageUrl);
        const { width, height, data } = imageData;

        const MAX_EXTENSION_PX = Math.max(width, height) * 1.5;

        // --- HELPER : Luminance ---
        function getPixelLuminance(cx, cy) {
            const x = Math.round(cx);
            const y = Math.round(cy);
            if (x < 0 || x >= width || y < 0 || y >= height) return null;
            const idx = (y * width + x) * 4;
            if (data[idx + 3] < 50) return null;
            return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        }

        // --- GÉOMÉTRIE DE BASE ---
        const p1 = points[0];
        const p2 = points[1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy) || 1;

        // Vecteur Directeur Unitaire (Parallèle)
        const ux = dx / len;
        const uy = dy / len;

        // Vecteur Perpendiculaire Unitaire (Normal) pour le mode AUTO
        const nx = -uy;
        const ny = ux;

        // --- ÉTAPE 1 : CALCUL DU DÉCALAGE (OFFSET) ---
        let finalOffsetX = 0;
        let finalOffsetY = 0;
        let debugOffsetSource = "NONE";

        // CAS A : DÉCALAGE MANUEL
        if (delta && delta.variant === "MANUAL" && typeof delta.value === "number") {
            debugOffsetSource = "MANUAL";
            const val = Math.abs(delta.value); // On gère le signe via la direction

            switch (delta.direction) {
                case "TOP":
                    finalOffsetY = -val;
                    break;
                case "BOTTOM":
                    finalOffsetY = val;
                    break;
                case "LEFT":
                    finalOffsetX = -val;
                    break;
                case "RIGHT":
                    finalOffsetX = val;
                    break;
                default:
                    // Par défaut ou erreur, pas de décalage
                    break;
            }
        }
        // CAS B : DÉCALAGE AUTOMATIQUE (Snapping sur le noir)
        else {
            debugOffsetSource = "AUTO";
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            let minLumFound = 255;

            for (let r = -searchRadius; r <= searchRadius; r++) {
                const scanX = midX + (nx * r);
                const scanY = midY + (ny * r);
                const lum = getPixelLuminance(scanX, scanY);

                if (lum !== null && lum < darkThreshold) {
                    if (lum < minLumFound) {
                        minLumFound = lum;
                        finalOffsetX = nx * r;
                        finalOffsetY = ny * r;
                    }
                }
            }
        }

        // Application du décalage aux points de départ
        const startX = p1.x + finalOffsetX;
        const startY = p1.y + finalOffsetY;
        const endX = p2.x + finalOffsetX;
        const endY = p2.y + finalOffsetY;

        // --- ÉTAPE 2 : EXTENSION LINÉAIRE ---
        function march(x, y, vx, vy) {
            let currX = x;
            let currY = y;
            let validX = x;
            let validY = y;
            let gap = 0;
            let dist = 0;
            let iterations = 0;

            while (dist < MAX_EXTENSION_PX) {
                const nextX = currX + (vx * stepSize);
                const nextY = currY + (vy * stepSize);

                const lum = getPixelLuminance(nextX, nextY);

                if (lum !== null && lum < darkThreshold) {
                    validX = nextX;
                    validY = nextY;
                    currX = nextX;
                    currY = nextY;
                    gap = 0;
                    iterations++;
                } else {
                    currX = nextX;
                    currY = nextY;
                    gap += stepSize;
                    if (gap > maxGap) break;
                }

                if (currX < 0 || currX >= width || currY < 0 || currY >= height) break;
                dist += stepSize;
            }

            return {
                point: { x: Math.round(validX), y: Math.round(validY) },
                iterations
            };
        }

        // Extension Avant (depuis P2 décalé)
        const resultFwd = march(endX, endY, ux, uy);

        // Extension Arrière (depuis P1 décalé)
        const resultBwd = march(startX, startY, -ux, -uy);

        const newSegment = [resultBwd.point, resultFwd.point];

        postMessage({
            msg,
            payload: {
                originalPoints: points,
                extendedPoints: newSegment,
                counters: { backward: resultBwd.iterations, forward: resultFwd.iterations },
                debugInfo: {
                    offsetMode: debugOffsetSource,
                    offsetApplied: { x: finalOffsetX, y: finalOffsetY }
                }
            }
        });

    } catch (err) {
        let errorMessage = err?.message || err;
        console.error("[opencv worker] extendLineAsync failed", errorMessage);
        postMessage({ msg, error: errorMessage });
    }
}