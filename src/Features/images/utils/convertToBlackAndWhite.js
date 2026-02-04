export default async function convertToBlackAndWhite(imageUrl, fileName = "image_bw.png") {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.width;
            canvas.height = img.height;

            // 1. Appliquer le filtre de niveaux de gris
            // 'grayscale(100%)' transforme l'image en noir et blanc
            // Tu peux aussi ajouter 'contrast(1.2)' pour rendre le trait plus dur
            ctx.filter = 'grayscale(100%)';

            // 2. Dessiner l'image avec le filtre appliqué
            ctx.drawImage(img, 0, 0);

            // 3. Conversion en File
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error("Erreur lors de la création du Blob"));
                    return;
                }
                const file = new File([blob], fileName, { type: "image/png" });
                resolve(file);
            }, 'image/png');
        };

        img.onerror = (err) => reject(new Error("Erreur de chargement de l'image : " + err));
    });
}