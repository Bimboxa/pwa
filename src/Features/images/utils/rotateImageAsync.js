/**
 * Rotates an image and returns a File object.
 * Adds a red border around the FINAL bounding box if rotation is not a multiple of 90 degrees.
 *
 * @param {string} imageUrl - Source URL.
 * @param {number} rotation - Rotation in degrees.
 * @param {string} [fileName] - Optional custom filename.
 * @returns {Promise<File>}
 */
export default async function rotateImageAsync({ imageUrl, rotation, fileName }) {
    const image = await createImageFromUrl(imageUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // --- 1. Calculate Bounding Box ---
    const radians = -(rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));

    // Dimensions of the final canvas (Bounding box)
    const newWidth = image.width * cos + image.height * sin;
    const newHeight = image.width * sin + image.height * cos;

    canvas.width = newWidth;
    canvas.height = newHeight;

    // --- 2. Draw Rotated Image ---
    // Move the context to the center of the new canvas
    ctx.translate(newWidth / 2, newHeight / 2);
    ctx.rotate(radians);

    // Draw the image centered relative to the rotation point
    ctx.drawImage(image, -image.width / 2, -image.height / 2);

    // --- 2b. Add Red Border around the FINAL Image (Bounding Box) ---
    if (rotation % 90 !== 0) {
        // IMPORTANT: Réinitialiser la transformation pour revenir au repère du canvas global
        // Cela annule le translate() et le rotate() précédents.
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        ctx.strokeStyle = '#fdfdfdff'; // Red
        ctx.lineWidth = 2;

        // On dessine le cadre autour de tout le canvas (newWidth / newHeight)
        // Note: strokeRect est centré sur la ligne. Pour un lineWidth de 2, 
        // 1px sera à l'intérieur, 1px coupé à l'extérieur. 
        // Si vous voulez tout le cadre visible, on peut faire un léger décalage (optionnel) :
        // ctx.strokeRect(1, 1, newWidth - 2, newHeight - 2); 

        // Version standard (bords du canvas) :
        ctx.strokeRect(0, 0, newWidth, newHeight);
    }

    // --- 3. Convert to File ---
    return new Promise((resolve, reject) => {
        const mimeType = 'image/png';

        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Canvas conversion failed'));
                return;
            }

            const finalName = fileName || extractFileName(imageUrl) || 'rotated-image.png';

            const file = new File([blob], finalName, {
                type: mimeType,
                lastModified: Date.now(),
            });

            resolve(file);
        }, mimeType);
    });
}

// Helper: Load Image
function createImageFromUrl(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
    });
}

// Helper: Extract filename from URL
function extractFileName(url) {
    try {
        return url.split('/').pop().split('?')[0];
    } catch (e) {
        return null;
    }
}