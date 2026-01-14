import {
    env,
    AutoProcessor,
    SamModel,
    RawImage,
    Tensor
} from '@huggingface/transformers';

// Configuration
env.allowLocalModels = false;
env.useBrowserCache = true;

// Configuration des couleurs pour les 3 candidats
const CANDIDATE_CONFIG = [
    { color: [255, 0, 0], css: 'rgba(255, 0, 0, 0.6)', name: 'Candidat 1 (Rouge)' },
    { color: [0, 255, 0], css: 'rgba(0, 255, 0, 0.6)', name: 'Candidat 2 (Vert)' },
    { color: [0, 0, 255], css: 'rgba(0, 0, 255, 0.6)', name: 'Candidat 3 (Bleu)' }
];

class SamWorker {
    static modelId = 'Xenova/slimsam-77-uniform';
    static model = null;
    static processor = null;

    static async getInstance(progress_callback) {
        if (!this.model || !this.processor) {
            this.processor = await AutoProcessor.from_pretrained(this.modelId);
            this.model = await SamModel.from_pretrained(this.modelId, {
                quantized: false,
                device: "webgpu",
                progress_callback
            });
        }
        return { model: this.model, processor: this.processor };
    }
}

const generateMaskImage = async (fullData, offset, width, height, colorConfig) => {
    const rgbaData = new Uint8ClampedArray(width * height * 4);
    const [r, g, b] = colorConfig.color;

    for (let i = 0; i < width * height; i++) {
        const val = fullData[offset + i];
        if (val > 0.0) {
            const idx = i * 4;
            rgbaData[idx + 0] = r;
            rgbaData[idx + 1] = g;
            rgbaData[idx + 2] = b;
            rgbaData[idx + 3] = 200;
        }
    }

    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d');
    ctx.putImageData(new ImageData(rgbaData, width, height), 0, 0);

    const blob = await offscreen.convertToBlob({ type: 'image/png' });

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve({
            processedImageUrl: reader.result,
            color: colorConfig.css,
            index: colorConfig.name
        });
    });
};

self.addEventListener("message", async (event) => {
    try {
        const { imageUrl, points, labels } = event.data;

        const { model, processor } = await SamWorker.getInstance((data) => {
            self.postMessage(data);
        });

        // 1. Préparation de l'image & Embeddings
        const image = await RawImage.read(imageUrl);
        const image_inputs = await processor(image);
        const image_embeddings = await model.get_image_embeddings(image_inputs);

        // 2. Calcul des coordonnées
        const reshaped = image_inputs.reshaped_input_sizes[0];
        const original = image_inputs.original_sizes[0];

        // On récupère le point unique
        const inputX = points[0][0][0];
        const inputY = points[0][0][1];

        // Mise à l'échelle
        const scaledPoints = [
            inputX * (reshaped[1] / original[1]),
            inputY * (reshaped[0] / original[0])
        ];

        // 3. TENSORS (CORRECTION ICI)

        // input_points reste en float32
        const input_points = new Tensor(
            'float32',
            scaledPoints,
            [1, 1, 1, 2]
        );

        // --- CORRECTION CRITIQUE : labels en int64 ---
        // On convertit les labels en BigInt pour satisfaire le type 'int64'
        const bigIntLabels = labels.flat(Infinity).map(l => BigInt(l));

        const input_labels = new Tensor(
            'int64', // Le modèle exige int64
            bigIntLabels,
            [1, 1, 1]
        );

        // 4. Inférence
        const outputs = await model({
            ...image_embeddings,
            input_points,
            input_labels,
        });

        // 5. Post-Processing
        const masks = await processor.post_process_masks(
            outputs.pred_masks,
            image_inputs.original_sizes,
            image_inputs.reshaped_input_sizes,
        );

        // 6. Génération des images
        const candidatesTensor = masks[0];

        // Le Tensor a la forme [1, 3, height, width]
        // dims[0] = 1 (Batch)
        // dims[1] = 3 (Channels / Nombre de masques)
        // dims[2] = Hauteur
        // dims[3] = Largeur

        const height = candidatesTensor.dims[2];
        const width = candidatesTensor.dims[3];
        const maskSize = width * height;

        // Sécurité : Vérifier qu'on a bien des dimensions valides
        if (!width || !height) {
            throw new Error(`Dimensions invalides: ${candidatesTensor.dims}`);
        }

        const promises = [];
        for (let i = 0; i < 3; i++) {
            const config = CANDIDATE_CONFIG[i];

            // Les données sont plates (flat array). 
            // Structure: [Masque1 (HxW)] [Masque2 (HxW)] [Masque3 (HxW)]
            const offset = i * maskSize;

            promises.push(
                generateMaskImage(candidatesTensor.data, offset, width, height, config)
            );
        }

        const results = await Promise.all(promises);

        self.postMessage({
            status: "complete",
            output: results,
        });

    } catch (e) {
        console.error("Worker Error:", e);
        self.postMessage({ status: "error", error: e.toString() });
    }
});