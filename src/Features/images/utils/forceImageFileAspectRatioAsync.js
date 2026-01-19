/**
 * Transforme une image pour forcer un aspect ratio en ajoutant des bandes blanches latérales.
 * * @param {File} imageFile - Le fichier image d'origine.
 * @param {number} aspectRatio - Le ratio désiré (ex: 16/9 ou 1.77).
 * @returns {Promise<File>} - Une promesse résolue avec le nouveau fichier image.
 */
function forceImageFileAspectRatioAsync(imageFile, aspectRatio) {
    return new Promise((resolve, reject) => {
        // 1. Vérification basique
        if (!imageFile.type.match(/image.*/)) {
            reject(new Error("Le fichier fourni n'est pas une image."));
            return;
        }

        const img = new Image();
        const url = URL.createObjectURL(imageFile);

        img.onload = () => {
            // 2. Calcul des dimensions
            const srcWidth = img.width;
            const srcHeight = img.height;

            // On fixe la hauteur et on calcule la largeur requise pour le ratio
            // Target Width = Hauteur * Ratio
            let targetHeight = srcHeight;
            let targetWidth = srcHeight * aspectRatio;

            // Sécurité : Si l'image est déjà plus large que le ratio cible (ex: panorama),
            // cette logique rognerait l'image. Si vous voulez ABSOLUMENT des bandes gauche/droite,
            // on garde la logique ci-dessus. Sinon, il faudrait agrandir la hauteur (bandes haut/bas).
            // Ici, on applique strictement votre demande (bandes latérales) :

            // 3. Préparation du Canvas
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');

            // 4. Remplissage du fond blanc
            ctx.fillStyle = '#FFFFFF'; // Blanc
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 5. Dessin de l'image centrée
            // Offset X = (Largeur Totale - Largeur Image) / 2
            const offsetX = (targetWidth - srcWidth) / 2;
            ctx.drawImage(img, offsetX, 0);

            // 6. Export vers un fichier
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error("Erreur lors de la conversion du canvas."));
                    return;
                }
                // Création du nouveau fichier avec le même nom et type (ou forcez 'image/jpeg' si voulu)
                const newFile = new File([blob], imageFile.name, {
                    type: imageFile.type,
                    lastModified: Date.now()
                });

                // Nettoyage mémoire
                URL.revokeObjectURL(url);
                resolve(newFile);

            }, imageFile.type, 1.0); // Qualité max (1.0)
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Impossible de charger l'image."));
        };

        img.src = url;
    });
}