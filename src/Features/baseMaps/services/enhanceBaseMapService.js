/**
 * Background service to enhance base map images.
 * The fetch continues even if the component unmounts, and dispatches the result when complete.
 */

let activeFetches = new Map(); // Map<baseMapId, { promise, abortController }>

export default async function enhanceBaseMapService({
  baseMapId,
  file,
  prompt, // Nouveau paramètre requis
  dispatch,
  onSuccess,
  onError,
}) {
  // Cancel any existing fetch for this baseMap
  const existing = activeFetches.get(baseMapId);
  if (existing) {
    existing.abortController.abort();
  }

  // Dispatch loading start
  if (dispatch) {
    dispatch({
      type: "baseMaps/setEnhancingBaseMap",
      payload: { baseMapId, isEnhancing: true },
    });
  }

  const abortController = new AbortController();
  const promise = (async () => {
    try {
      // 1. Préparation du FormData (équivalent à --form dans curl)
      const formData = new FormData();
      formData.append("file", file);
      formData.append("prompt", prompt || "Améliore cette image"); // Valeur par défaut si prompt vide

      const res = await fetch(
        "https://n8nk.etandex.fr/webhook/gemini-image", // Nouvelle URL
        {
          method: "POST",
          // IMPORTANT : Pas de header "Content-Type" ici. 
          // Le navigateur le mettra automatiquement à "multipart/form-data; boundary=..."
          body: formData,
          signal: abortController.signal,
        }
      );

      if (!res.ok) {
        throw new Error(`Enhancement failed (${res.status})`);
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.startsWith("image/")) {
        throw new Error("Response is not an image");
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      // Dispatch result to Redux
      if (dispatch) {
        dispatch({
          type: "baseMaps/setEnhancedImageResult",
          payload: {
            baseMapId,
            blob,
            objectUrl,
            completedAt: Date.now(),
          },
        });
      }

      // Call success callback if provided
      if (onSuccess) {
        onSuccess({ blob, objectUrl });
      }

      return { blob, objectUrl };
    } catch (error) {
      if (error.name === "AbortError") {
        console.log(
          `[enhanceBaseMapService] Fetch aborted for baseMap ${baseMapId}`
        );
        return null;
      }

      console.error(
        "[enhanceBaseMapService] Failed to enhance base map:",
        error
      );

      // Dispatch error to Redux
      if (dispatch) {
        dispatch({
          type: "baseMaps/setEnhancedImageError",
          payload: {
            baseMapId,
            error: error.message || String(error),
            failedAt: Date.now(),
          },
        });
      }

      // Call error callback if provided
      if (onError) {
        onError(error);
      }

      throw error;
    } finally {
      // Clean up
      activeFetches.delete(baseMapId);
      // Dispatch loading stop (if not already done by result/error actions)
      if (dispatch) {
        dispatch({
          type: "baseMaps/setEnhancingBaseMap",
          payload: { baseMapId, isEnhancing: false },
        });
      }
    }
  })();

  activeFetches.set(baseMapId, { promise, abortController });

  return promise;
}

/**
 * Cancel an active fetch for a baseMap
 */
export function cancelEnhanceBaseMap(baseMapId) {
  const existing = activeFetches.get(baseMapId);
  if (existing) {
    existing.abortController.abort();
    activeFetches.delete(baseMapId);
  }
}

/**
 * Get the active fetch promise for a baseMap (if any)
 */
export function getActiveEnhanceFetch(baseMapId) {
  return activeFetches.get(baseMapId)?.promise;
}