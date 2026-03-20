import { useState, useEffect } from "react";

import { useDispatch } from "react-redux";
import { setGrayLevelThreshold } from "Features/baseMapEditor/baseMapEditorSlice";

import useCreateBaseMapVersion from "Features/baseMaps/hooks/useCreateBaseMapVersion";
import useReplaceVersionImage from "Features/baseMaps/hooks/useReplaceVersionImage";

import {
  Box,
  Typography,
  List,
  ListItemButton,
  IconButton,
  Slider,
  CircularProgress,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { Save as SaveIcon } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import SectionCompareTwoImages from "./SectionCompareTwoImages";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import ToolMorphology from "Features/baseMapEditor/components/ToolMorphology";
import convertToBlackAndWhite from "Features/images/utils/convertToBlackAndWhite";
import addBackgroundToImage from "Features/images/utils/addBackgroundToImage";

export default function SectionBasicTransforms({ baseMap }) {
  const dispatch = useDispatch();

  // data

  const createVersion = useCreateBaseMapVersion();
  const replaceVersionImage = useReplaceVersionImage();

  // helpers

  const activeVersion = baseMap?.getActiveVersion?.();
  const versionUrl = baseMap?.getUrl?.();

  // state

  const [tempResult, setTempResult] = useState(null);
  const [openCompare, setOpenCompare] = useState(false);
  const [createNewVersion, setCreateNewVersion] = useState(true);
  const [grayLevelValue, setGrayLevelValue] = useState(255);
  const [grayLevelProcessing, setGrayLevelProcessing] = useState(false);

  // effects

  useEffect(() => {
    dispatch(setGrayLevelThreshold(grayLevelValue));
  }, [grayLevelValue, dispatch]);

  useEffect(() => {
    return () => dispatch(setGrayLevelThreshold(255));
  }, [dispatch]);

  // handlers - compare dialog

  function handleTransformResult(file, label) {
    const objectUrl = URL.createObjectURL(file);
    setTempResult({ file, label, objectUrl });
    setOpenCompare(true);
    setCreateNewVersion(true);
  }

  function handleCloseCompare() {
    if (tempResult?.objectUrl) URL.revokeObjectURL(tempResult.objectUrl);
    setTempResult(null);
    setOpenCompare(false);
  }

  async function handleSave() {
    if (!tempResult?.file || !baseMap?.id || !activeVersion?.id) return;

    const originalTransform = baseMap.getActiveVersionTransform();
    const originalImageSize = baseMap.getActiveImageSize();
    let transform;
    if (originalImageSize && tempResult.objectUrl) {
      const newSize = await new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = tempResult.objectUrl;
      });
      if (newSize && newSize.width > 0) {
        const scale =
          (originalImageSize.width * (originalTransform.scale || 1)) /
          newSize.width;
        transform = { ...originalTransform, scale };
      }
    }

    if (createNewVersion) {
      await createVersion(baseMap.id, tempResult.file, {
        label: tempResult.label,
        transform,
      });
    } else {
      await replaceVersionImage(baseMap.id, activeVersion.id, tempResult.file, {
        transform,
      });
    }
    handleCloseCompare();
  }

  // handlers - basic transforms

  async function handleAddBackground() {
    if (!versionUrl) return;
    const file = await addBackgroundToImage(versionUrl, "#FFFFFF");
    if (file) handleTransformResult(file, "Fond blanc");
  }

  async function handleBlackAndWhite() {
    if (!versionUrl) return;
    const file = await convertToBlackAndWhite(versionUrl);
    if (file) handleTransformResult(file, "Noir et blanc");
  }

  async function handleHalveSize() {
    if (!versionUrl) return;
    const img = await new Promise((resolve, reject) => {
      const i = new window.Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = versionUrl;
    });
    const w = Math.round(img.naturalWidth / 2);
    const h = Math.round(img.naturalHeight / 2);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    if (blob) {
      const file = new File([blob], "halved.png", { type: "image/png" });
      handleTransformResult(file, "Taille / 2");
    }
  }

  async function handleGrayLevelConfirm() {
    if (!versionUrl) return;
    setGrayLevelProcessing(true);
    try {
      const cv = (await import("Features/opencv/services/opencvService")).default;
      await cv.load();
      const { processedImageFile } = await cv.applyGrayLevelThresholdAsync({
        imageUrl: versionUrl,
        grayLevelThreshold: grayLevelValue,
      });
      if (processedImageFile) {
        handleTransformResult(processedImageFile, "Seuil de gris");
      }
    } finally {
      setGrayLevelProcessing(false);
      setGrayLevelValue(255);
    }
  }

  // render

  if (!activeVersion || !versionUrl) return null;

  return (
    <>
      <Box
        sx={{
          borderRadius: "8px",
          border: (theme) => `1px solid ${theme.palette.divider}`,
          overflow: "hidden",
          mt: 1,
        }}
      >
        <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            Transformations basiques
          </Typography>
        </Box>

        <List dense disablePadding>
          <ListItemButton onClick={handleAddBackground} divider>
            <Typography variant="body2" color="text.secondary">
              Ajouter un fond blanc
            </Typography>
          </ListItemButton>

          <ListItemButton onClick={handleBlackAndWhite} divider>
            <Typography variant="body2" color="text.secondary">
              Noir et blanc
            </Typography>
          </ListItemButton>

          <ListItemButton onClick={handleHalveSize} divider>
            <Typography variant="body2" color="text.secondary">
              Diviser la taille par 2
            </Typography>
          </ListItemButton>

          <ToolMorphology baseMap={baseMap} onResult={handleTransformResult} />

          <Box
            sx={{
              borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              px: 2,
              py: 1,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 0.5,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Filtre en niveaux de gris
              </Typography>
              <IconButton
                size="small"
                onClick={handleGrayLevelConfirm}
                disabled={grayLevelProcessing || grayLevelValue === 255}
                title="Enregistrer"
              >
                {grayLevelProcessing ? (
                  <CircularProgress size={18} />
                ) : (
                  <SaveIcon fontSize="small" />
                )}
              </IconButton>
            </Box>

            <Slider
              value={255 - grayLevelValue}
              min={0}
              max={255}
              onChange={(e, pos) => setGrayLevelValue(255 - pos)}
              sx={{
                height: 12,
                padding: "6px 0",
                "& .MuiSlider-rail": {
                  opacity: 1,
                  background:
                    "linear-gradient(90deg, #ffffff 0%, #000000 100%)",
                  border: "1px solid rgba(0,0,0,0.1)",
                },
                "& .MuiSlider-track": {
                  backgroundColor: "#ffffff",
                  border: "1px solid #bdbdbd",
                  opacity: 1,
                },
                "& .MuiSlider-thumb": {
                  height: 22,
                  width: 22,
                  backgroundColor: `rgb(${grayLevelValue}, ${grayLevelValue}, ${grayLevelValue})`,
                  border: `2px solid ${grayLevelValue > 128 ? "#000" : "#fff"}`,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  "&:hover": {
                    boxShadow: "0 0 0 8px rgba(33, 150, 243, 0.16)",
                  },
                  "&::before": { boxShadow: "none" },
                },
              }}
            />
          </Box>

        </List>
      </Box>

      {/* Compare dialog */}
      {openCompare && tempResult && (
        <DialogGeneric
          open={openCompare}
          vh={90}
          onClose={handleCloseCompare}
        >
          <BoxFlexVStretch sx={{ width: 1, height: 1, position: "relative" }}>
            <SectionCompareTwoImages
              imageUrl1={tempResult.objectUrl}
              imageUrl2={versionUrl}
            />
            <Box
              sx={{
                position: "absolute",
                bottom: 8,
                right: 8,
                display: "flex",
                alignItems: "center",
                gap: 1,
                bgcolor: "white",
                borderRadius: 1,
                px: 1.5,
                py: 0.5,
                boxShadow: 2,
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={createNewVersion}
                    onChange={(e) => setCreateNewVersion(e.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="caption" color="text.primary">
                    Nouvelle version
                  </Typography>
                }
              />
              <ButtonGeneric
                label="Enregistrer"
                variant="contained"
                color="secondary"
                onClick={handleSave}
              />
            </Box>
          </BoxFlexVStretch>
        </DialogGeneric>
      )}
    </>
  );
}
