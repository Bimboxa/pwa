import { pipeline, env } from '@huggingface/transformers';

// Optionnel : Empêcher le chargement des modèles locaux si nécessaire
// env.allowLocalModels = false;

class SegmentationPipeline {
    // Tâche : 'image-segmentation' pour les masques, 'object-detection' pour les boites
    static task = 'image-segmentation';

    // Modèle : SegFormer est léger et efficace pour le web
    static model = 'Xenova/segformer-b0-finetuned-ade-512-512';

    static instance = null;

    static async getInstance(progress_callback = null) {
        // On initialise le pipeline une seule fois (Singleton)
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener("message", async (event) => {
    // Retrieve the translation pipeline. When called for the first time,
    // this will load the pipeline and save it for future use.
    const segmentor = await SegmentationPipeline.getInstance((x) => {
        // We also add a progress callback to the pipeline so that we can
        // track model loading.
        self.postMessage(x);
    });

    // Actually perform the translation
    const output = await segmentor(event.data.imageUrl)
    console.log("debug_output", output);

    // Send the output back to the main thread
    self.postMessage({
        status: "complete",
        output,
    });
});