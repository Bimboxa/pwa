export default async function generateThumbnail(file, size = 32) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                canvas.width = size;
                canvas.height = size;

                // Calcul du ratio pour le "Object-Fit: Cover"
                const scale = Math.max(size / img.width, size / img.height);
                const x = (size / 2) - (img.width / 2) * scale;
                const y = (size / 2) - (img.height / 2) * scale;

                // Dessin de l'image centrée et redimensionnée
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

                // Export en Base64 (WebP est plus léger, sinon 'image/jpeg')
                resolve(canvas.toDataURL('image/webp', 0.8));
            };
        };
        reader.onerror = (error) => reject(error);
    });
}

// Exemple d'utilisation avec un input file :
// const base64 = await generateThumbnail(myFileInput.files[0], 32);
// console.log(base64);