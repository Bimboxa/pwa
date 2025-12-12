/**
 * Réorganise les annotations de type LABEL pour éviter les chevauchements sur les bords.
 * Version améliorée : Gère le Zoom (Scale) et optimise le tri.
 * * @param {Array} annotations - Liste complète des annotations
 * @param {Object} imageSize - { width, height } dimensions originales de l'image
 * @param {Object} options - Configuration
 * @param {number} mapScale - Le niveau de zoom actuel (basePose.k). Crucial pour la conversion px -> %
 */
export default function getAutoLayoutLabels(annotations, imageSize, options = {}, mapScale = 1) {
    const {
        labelHeight = 40,   // Hauteur écran (px)
        labelWidth = 120,   // Largeur écran (px)
        gap = 5,            // Marge entre étiquettes écran (px)
        offset = 60,        // Distance du bord écran (px)
    } = options;

    if (!imageSize || !annotations) return annotations;

    // --- 1. CONFIGURATION ÉCHELLE ---
    // On convertit les tailles "Écran" en taille "Image" en divisant par le scale.
    // Exemple : Si zoom = 0.5 (image à 50%), 40px écran équivalent à 80px sur l'image.
    const k = mapScale || 1;

    // Dimensions normalisées (0-1) relatives à l'image
    const hPct = (labelHeight / k) / imageSize.height;
    const wPct = (labelWidth / k) / imageSize.width;
    const gapHPct = (gap / k) / imageSize.height;
    const gapWPct = (gap / k) / imageSize.width;

    // Offset (Distance du bord)
    const offX = (offset / k) / imageSize.width;
    const offY = (offset / k) / imageSize.height;

    // --- 2. PRÉPARATION ---
    const workingLabels = annotations
        .filter(a => a.type === "LABEL")
        .map(label => ({
            id: label.id,
            targetPoint: label.targetPoint,
            // On initialise avec la position actuelle ou la cible par défaut
            currentLabelPoint: { ...label.labelPoint || label.targetPoint }
        }));

    if (workingLabels.length === 0) return annotations;

    const groups = { top: [], right: [], bottom: [], left: [] };

    // --- 3. CLASSIFICATION ---
    // On détermine le bord le plus proche pour chaque étiquette
    workingLabels.forEach(item => {
        const { x, y } = item.targetPoint;
        const dTop = y;
        const dBottom = 1 - y;
        const dLeft = x;
        const dRight = 1 - x;
        const min = Math.min(dTop, dBottom, dLeft, dRight);

        if (min === dTop) groups.top.push(item);
        else if (min === dBottom) groups.bottom.push(item);
        else if (min === dLeft) groups.left.push(item);
        else groups.right.push(item);
    });

    // --- 4. ALGORITHME DE RÉSOLUTION 1D ---
    const solve1D = (items, getKey, setKey, sizeItem, sizeGap) => {
        if (items.length === 0) return;

        // A. TRI : On trie selon la position de la CIBLE (pour éviter que les lignes se croisent)
        items.sort((a, b) => getKey(a.targetPoint) - getKey(b.targetPoint));

        // B. PLACEMENT INITIAL : On place le centre de l'étiquette face à sa cible
        let slots = items.map(item => {
            const center = getKey(item.targetPoint);
            return {
                itemRef: item,
                start: center - sizeItem / 2,
                end: center + sizeItem / 2
            };
        });

        // C. EMPILAGE (Push Forward) : On pousse vers le bas/droite si ça se chevauche
        for (let i = 0; i < slots.length - 1; i++) {
            const current = slots[i];
            const next = slots[i + 1];

            // Si la fin du courant (+ marge) dépasse le début du suivant
            if (current.end + sizeGap > next.start) {
                const overlap = (current.end + sizeGap) - next.start;
                // On déplace le suivant
                next.start += overlap;
                next.end += overlap;
            }
        }

        // D. RECENTRAGE (Pull Back) : On recentre le groupe entier
        // Cela évite que tout le monde soit poussé vers le bas si le premier était tout en haut
        const meanTarget = slots.reduce((sum, s) => sum + getKey(s.itemRef.targetPoint), 0) / slots.length;
        const meanCurrent = slots.reduce((sum, s) => sum + (s.start + sizeItem / 2), 0) / slots.length;
        const shift = meanTarget - meanCurrent;

        // E. APPLICATION
        slots.forEach(slot => {
            const finalPos = (slot.start + sizeItem / 2) + shift;
            setKey(slot.itemRef.currentLabelPoint, finalPos);
        });
    };

    // --- 5. APPLICATION SUR LES 4 BORDS ---

    // GAUCHE (Répartir Y, Fixer X)
    solve1D(groups.left, p => p.y, (p, v) => p.y = v, hPct, gapHPct);
    groups.left.forEach(l => l.currentLabelPoint.x = -offX); // Extérieur gauche

    // DROITE (Répartir Y, Fixer X)
    solve1D(groups.right, p => p.y, (p, v) => p.y = v, hPct, gapHPct);
    groups.right.forEach(l => l.currentLabelPoint.x = 1 + offX); // Extérieur droite

    // HAUT (Répartir X, Fixer Y)
    solve1D(groups.top, p => p.x, (p, v) => p.x = v, wPct, gapWPct);
    groups.top.forEach(l => l.currentLabelPoint.y = -offY); // Extérieur haut

    // BAS (Répartir X, Fixer Y)
    solve1D(groups.bottom, p => p.x, (p, v) => p.x = v, wPct, gapWPct);
    groups.bottom.forEach(l => l.currentLabelPoint.y = 1 + offY); // Extérieur bas

    // --- 6. RECONSTRUCTION ---
    const newPositionsMap = new Map();
    workingLabels.forEach(l => newPositionsMap.set(l.id, l.currentLabelPoint));

    return annotations.map(ann => {
        if (ann.type === "LABEL" && newPositionsMap.has(ann.id)) {
            return {
                ...ann,
                labelPoint: newPositionsMap.get(ann.id)
            };
        }
        return ann;
    });
}