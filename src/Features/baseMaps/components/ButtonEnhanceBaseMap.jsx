import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Box } from "@mui/material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import ButtonActionInPanel from "Features/layout/components/ButtonActionInPanel";
import ImageGeneric from "Features/images/components/ImageGeneric";

import useUpdateBaseMapWithImageEnhanced from "../hooks/useUpdateBaseMapWithImageEnhanced";
import enhanceBaseMapService, {
  getActiveEnhanceFetch,
} from "../services/enhanceBaseMapService";
import {
  setEnhancedImageResult,
  clearEnhancedImageResult,
} from "../baseMapsSlice";

export default function ButtonEnhanceBaseMap() {
  const dispatch = useDispatch();

  // strings

  const labelS = "Améliorer l'image";

  // data

  const baseMap = useMainBaseMap();
  const enhancedResult = useSelector(
    (s) => s.baseMaps?.enhancedImageResults?.[baseMap?.id]
  );
  const enhancedError = useSelector(
    (s) => s.baseMaps?.enhancedImageErrors?.[baseMap?.id]
  );
  const isEnhancing = useSelector(
    (s) => s.baseMaps?.enhancingBaseMapIds?.[baseMap?.id] === true
  );

  // state - sync with Redux loading state
  const [loading, setLoading] = useState(false);
  const [triggerOpenAt, setTriggerOpenAt] = useState(false);

  // data - update

  const update = useUpdateBaseMapWithImageEnhanced();

  // handlers

  // Check on mount if there's an active fetch running
  useEffect(() => {
    if (baseMap?.id) {
      // Check Redux state first
      if (isEnhancing) {
        setLoading(true);
      } else {
        // Also check the service's active fetches (in case Redux wasn't updated)
        const activeFetch = getActiveEnhanceFetch(baseMap.id);
        if (activeFetch) {
          setLoading(true);
        }
      }
    }
  }, [baseMap?.id, isEnhancing]);

  // Sync local loading state with Redux
  useEffect(() => {
    setLoading(isEnhancing);
  }, [isEnhancing]);

  // Clean up object URL when component unmounts or result changes
  useEffect(() => {
    return () => {
      if (enhancedResult?.objectUrl) {
        // Don't revoke here - let Redux manage it via clearEnhancedImageResult
      }
    };
  }, [enhancedResult?.objectUrl]);

  // Watch for completed background fetch
  useEffect(() => {
    if (enhancedResult) {
      // Background fetch completed - result is already in Redux
      setLoading(false);
      setTriggerOpenAt(Date.now());
    }
  }, [enhancedResult]);

  // Watch for errors
  useEffect(() => {
    if (enhancedError) {
      setLoading(false);
      console.error("Failed to enhance base map:", enhancedError.error);
    }
  }, [enhancedError]);

  async function handleClick() {
    if (!baseMap?.image?.file || !baseMap?.id) return;

    setLoading(true);

    // Start background fetch - it will dispatch result to Redux when complete
    enhanceBaseMapService({
      baseMapId: baseMap.id,
      file: baseMap.image.file,
      dispatch,
      onSuccess: () => {
        setLoading(false);
      },
      onError: () => {
        setLoading(false);
      },
    }).catch(() => {
      // Error already handled in service
      setLoading(false);
    });
  }

  async function handleSave() {
    if (!enhancedResult?.blob || !baseMap?.id) return;

    const file = new File([enhancedResult.blob], "enhanced.png");
    await update(baseMap.id, file);

    // Clear the result after saving
    dispatch(clearEnhancedImageResult(baseMap.id));
  }

  const previewUrl = enhancedResult?.objectUrl;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {enhancedError && (
        <Box sx={{ color: "error.main", fontSize: "0.875rem" }}>
          Erreur: {enhancedError.error}
        </Box>
      )}
      <ButtonActionInPanel
        label={labelS}
        onClick={handleClick}
        loading={loading}
        variant="body2"
        color="secondary"
        triggerOpenAt={triggerOpenAt}
      >
        {previewUrl && (
          <Box sx={{ position: "relative" }}>
            <Box
              sx={{
                maxWidth: 280,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
              }}
            >
              <ImageGeneric url={previewUrl} />
            </Box>
            <Box sx={{ mt: 1 }}>
              <ButtonGeneric label="Enregistrer" onClick={handleSave} />
            </Box>
          </Box>
        )}
      </ButtonActionInPanel>
    </Box>
  );
}
