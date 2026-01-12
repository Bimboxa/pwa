/**
 * Calcule la BBox initiale (normalisée 0-1) centrée dans le conteneur.
 *
 * @param {Object} params
 * @param {Object} params.containerImageSize - Taille du conteneur { width, height }
 * @param {Object} params.imageSize - Taille de l'image à annoter { width, height }
 * @param {boolean} [params.asImageRatio=false] - Si true, conserve le ratio de l'image
 * @returns {Object} { x, y, width, height } en coordonnées normalisées (0-1)
 */
export default function getImageAnnotationInitialBbox({
    containerImageSize,
    imageSize,
    asImageRatio = false,
}) {
    // 1. On définit la cible : la largeur doit être la moitié du conteneur (0.5)
    // On travaille en coordonnées normalisées (0 à 1)
    const TARGET_SIZE = 0.5;

    let width = TARGET_SIZE;
    let height = TARGET_SIZE;

    // 2. Si on doit respecter le ratio de l'image
    if (asImageRatio && imageSize && containerImageSize) {
        const imgAspect = imageSize.width / imageSize.height;
        const containerAspect = containerImageSize.width / containerImageSize.height;

        // Formule : HauteurNorm = LargeurNorm * (RatioConteneur / RatioImage)
        height = width * (containerAspect / imgAspect);
    }

    // 3. Calcul du centrage
    // x = (1 - width) / 2
    const x = (1 - width) / 2;
    const y = (1 - height) / 2;

    return { x, y, width, height };
}