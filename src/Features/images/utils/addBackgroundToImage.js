export default async function addBackgroundToImage(imageUrl, bgColor = "#FFFFFF", fileName = "image_enhanced.png") {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.width;
            canvas.height = img.height;

            // 1. On peint le fond
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. On dessine l'image par-dessus
            ctx.drawImage(img, 0, 0);

            // 3. Conversion en Blob puis en File
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