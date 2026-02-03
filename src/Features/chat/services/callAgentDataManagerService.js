import fileToBase64 from "Features/images/utils/fileToBase64";

/**
 * Service d'appel à l'Agent Cloudflare
 */
export default async function callAgentDataManagerService({
    data,
    userPrompt,
    structure = "TREE",
    dataName = "Projet",
    imageFile = null,
    baseUrl,
    AGENT_API_TOKEN
}) {
    // 1. Validation de sécurité locale
    if (!AGENT_API_TOKEN) throw new Error("API Token manquant");
    if (!data) throw new Error("Données sources manquantes");

    let imageBase64 = null;
    if (imageFile) {
        try {
            const fullBase64 = await fileToBase64(imageFile);
            // On s'assure de ne pas envoyer le préfixe "data:image/png;base64," 
            // si votre utilitaire ne le retire pas déjà.
            imageBase64 = fullBase64.includes(",") ? fullBase64.split(",")[1] : fullBase64;
        } catch (e) {
            console.error("Erreur lors de la conversion de l'image:", e);
        }
    }

    // 2. Préparation du payload
    const payload = {
        data, // L'arbre ou le tableau
        userPrompt,
        structure,
        dataName,
        imageBase64
    };

    console.log(`[FRONT] Sending request to Agent. Data size: ${JSON.stringify(data).length} chars.`);

    // 3. Appel Fetch avec gestion de timeout (optionnel mais recommandé)
    const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${AGENT_API_TOKEN}`
        },
        body: JSON.stringify(payload)
    });

    // 4. Gestion des erreurs HTTP
    if (!response.ok) {
        let errorMessage = "Erreur API";
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            // Si l'erreur vient du formatage détecté par les logs du Worker
            if (errorData.debug) console.log("[FRONT] Debug info from Worker:", errorData.debug);
        } catch (e) {
            // Cas où la réponse n'est pas du JSON (ex: erreur 502/504 de Cloudflare)
            errorMessage = `Erreur serveur (${response.status})`;
        }
        throw new Error(errorMessage);
    }

    return await response.json();
};