import { useState, useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setEnhancingBaseMap } from "Features/baseMaps/baseMapsSlice";
import { setGrayLevelThreshold } from "Features/baseMapEditor/baseMapEditorSlice";

import useBaseMapTransforms from "Features/baseMapTransforms/hooks/useBaseMapTransforms";
import useCreateBaseMapVersion from "Features/baseMaps/hooks/useCreateBaseMapVersion";
import useReplaceVersionImage from "Features/baseMaps/hooks/useReplaceVersionImage";

import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  IconButton,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Menu,
  MenuItem,
  Slider,
} from "@mui/material";
import {
  Add as AddIcon,
  MoreVert,
  Edit,
  Delete,
  Stop,
  Compare,
  Save as SaveIcon,
  ContentCopy,
} from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";
import DialogEditBaseMapTransform from "Features/baseMapTransforms/components/DialogEditBaseMapTransform";
import DialogCreateBaseMapTransform from "Features/baseMapTransforms/components/DialogCreateBaseMapTransform";
import SectionCompareTwoImages from "Features/baseMapTransforms/components/SectionCompareTwoImages";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import ToolReplaceColor from "Features/baseMapEditor/components/ToolReplaceColor";
import ToolMergeVisibleAnnotations from "Features/baseMapEditor/components/ToolMergeVisibleAnnotations";
import ToolMorphology from "Features/baseMapEditor/components/ToolMorphology";
import ToolConnectedComponentsFilter from "Features/baseMapEditor/components/ToolConnectedComponentsFilter";
import convertToBlackAndWhite from "Features/images/utils/convertToBlackAndWhite";
import convertToBinary from "Features/images/utils/convertToBinary";
import addBackgroundToImage from "Features/images/utils/addBackgroundToImage";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import enhanceBaseMapService, {
  cancelEnhanceBaseMap,
} from "Features/baseMaps/services/enhanceBaseMapService";

export default function SectionVersionTransforms({ baseMap, versionId }) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  const baseMapTransforms = useBaseMapTransforms();
  const createVersion = useCreateBaseMapVersion();
  const replaceVersionImage = useReplaceVersionImage();
  const enhancedResult = useSelector(
    (s) => s.baseMaps?.enhancedImageResults?.[baseMap?.id]
  );
  const enhancingBaseMap = useSelector(
    (s) => s.baseMaps?.enhancingBaseMapIds?.[baseMap?.id]
  );
  const enhancingTransformId = enhancingBaseMap?.transformId;

  // helpers

  const version = baseMap?.versions?.find((v) => v.id === versionId);
  const versionUrl = baseMap?.getVersionUrl(versionId);

  // state

  const [tempResult, setTempResult] = useState(null); // { file, label, objectUrl }
  const [openCompare, setOpenCompare] = useState(false);
  const [createNewVersion, setCreateNewVersion] = useState(true);
  // smart transform menu/dialogs
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [activeTransform, setActiveTransform] = useState(null);
  const [openEditTransform, setOpenEditTransform] = useState(false);
  const [openDeleteTransform, setOpenDeleteTransform] = useState(false);
  const [openCreateTransform, setOpenCreateTransform] = useState(false);
  const [duplicateTransform, setDuplicateTransform] = useState(null);
  // gray level threshold
  const [grayLevelValue, setGrayLevelValue] = useState(255);
  const [grayLevelProcessing, setGrayLevelProcessing] = useState(false);

  // effect - sync gray level to viewer and reset on unmount
  useEffect(() => {
    dispatch(setGrayLevelThreshold(grayLevelValue));
  }, [grayLevelValue, dispatch]);

  useEffect(() => {
    return () => dispatch(setGrayLevelThreshold(255));
  }, [dispatch]);

  // handlers - shared

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
    if (!tempResult?.file || !baseMap?.id || !versionId) return;

    // Compute transform so a smaller AI image overlays the original at the same size
    const originalTransform = baseMap.getActiveVersionTransform();
    const originalImageSize = baseMap.getActiveImageSize();
    let transform;
    if (originalImageSize && tempResult.objectUrl) {
      const newSize = await new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = tempResult.objectUrl;
      });
      if (newSize && newSize.width > 0) {
        const scale = (originalImageSize.width * (originalTransform.scale || 1)) / newSize.width;
        transform = { ...originalTransform, scale };
      }
    }

    if (createNewVersion) {
      await createVersion(baseMap.id, tempResult.file, {
        label: tempResult.label,
        transform,
      });
    } else {
      await replaceVersionImage(baseMap.id, versionId, tempResult.file, { transform });
    }
    handleCloseCompare();
  }

  // handlers - basic transforms

  async function handleBlackAndWhite() {
    if (!versionUrl) return;
    const file = await convertToBlackAndWhite(versionUrl);
    if (file) handleTransformResult(file, "Noir et blanc");
  }

  async function handleBinary() {
    if (!versionUrl) return;
    const file = await convertToBinary(versionUrl);
    if (file) handleTransformResult(file, "Binaire");
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

  async function handleAddBackground() {
    if (!versionUrl) return;
    const file = await addBackgroundToImage(versionUrl, "#FFFFFF");
    if (file) handleTransformResult(file, "Fond blanc");
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
        const url = URL.createObjectURL(processedImageFile);
        const withBg = await addBackgroundToImage(url, "#FFFFFF");
        URL.revokeObjectURL(url);
        handleTransformResult(withBg || processedImageFile, "Seuil de gris");
      }
    } finally {
      setGrayLevelProcessing(false);
      setGrayLevelValue(255);
    }
  }

  // handlers - smart transforms

  function handleSmartTransformClick(transform) {
    if (!version?.image?.file || !baseMap?.id) return;
    if (enhancingTransformId) return;

    enhanceBaseMapService({
      baseMapId: baseMap.id,
      transformId: transform.id,
      file: version.image.file,
      prompt: transform.prompt,
      serviceUrl: appConfig?.features?.enhanceBaseMap?.fetchParams?.url,
      dispatch,
      onSuccess: ({ blob }) => {
        const file = new File([blob], "enhanced.png", { type: "image/png" });
        handleTransformResult(file, transform.name || "Smart transform");
      },
      onError: () => { },
    });
  }

  function handleAbortSmartTransform(e, transformId) {
    e.stopPropagation();
    if (baseMap?.id) cancelEnhanceBaseMap(baseMap.id);
    dispatch(
      setEnhancingBaseMap({
        transformId,
        isEnhancing: false,
        baseMapId: baseMap?.id,
      })
    );
  }

  // handlers - smart transform menu

  function handleOpenMenu(e, transform) {
    if (enhancingTransformId === transform.id) return;
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setActiveTransform(transform);
  }

  function handleCloseMenu() {
    setMenuAnchor(null);
  }

  // render

  if (!version || !versionUrl) return null;

  return (
    <>
      {/* SMART TRANSFORMS */}
      <Box
        sx={{
          bgcolor: "white",
          borderRadius: 1,
          border: (theme) => `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            px: 2,
            pt: 1.5,
            pb: 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            Transformations (IA)
          </Typography>
          <IconButton size="small" onClick={() => setOpenCreateTransform(true)}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>

        <List dense disablePadding>
          {baseMapTransforms?.map((transform) => {
            const isEnhancingThis = enhancingTransformId === transform.id;
            return (
              <ListItem
                key={transform.id}
                disablePadding
                divider
                secondaryAction={
                  isEnhancingThis ? (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        pr: 1,
                      }}
                    >
                      <CircularProgress size={20} color="secondary" />
                      <IconButton
                        edge="end"
                        onClick={(e) =>
                          handleAbortSmartTransform(e, transform.id)
                        }
                        color="error"
                        size="small"
                      >
                        <Stop fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : (
                    <IconButton
                      edge="end"
                      onClick={(e) => handleOpenMenu(e, transform)}
                    >
                      <MoreVert fontSize="small" />
                    </IconButton>
                  )
                }
                sx={{
                  "& .MuiListItemSecondaryAction-root": {
                    opacity: isEnhancingThis ? 1 : 0,
                    transition: "opacity 0.2s",
                    pointerEvents: isEnhancingThis ? "auto" : "none",
                  },
                  "&:hover .MuiListItemSecondaryAction-root": {
                    opacity: 1,
                    pointerEvents: "auto",
                  },
                }}
              >
                <ListItemButton
                  onClick={() => handleSmartTransformClick(transform)}
                  disabled={
                    !!enhancingTransformId && !isEnhancingThis
                  }
                  selected={isEnhancingThis}
                >
                  <Typography variant="body2" color="text.secondary">
                    {transform.name}
                  </Typography>
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* COLOR REPLACEMENT */}
      <ToolReplaceColor baseMap={baseMap} onResult={handleTransformResult} />

      {/* BASIC TRANSFORMS */}
      <Box
        sx={{
          bgcolor: "white",
          borderRadius: 1,
          border: (theme) => `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
        }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
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

          <ListItemButton onClick={handleBinary} divider>
            <Typography variant="body2" color="text.secondary">
              Binaire
            </Typography>
          </ListItemButton>

          <ListItemButton onClick={handleHalveSize} divider>
            <Typography variant="body2" color="text.secondary">
              Diviser la taille par 2
            </Typography>
          </ListItemButton>

          <ToolMorphology baseMap={baseMap} onResult={handleTransformResult} />

          <ToolConnectedComponentsFilter
            baseMap={baseMap}
            onResult={handleTransformResult}
          />

          <Box
            sx={{
              borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              px: 2,
              py: 1,
            }}
          >
            {/* Line 1: title + save button */}
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

            {/* Line 2: slider full width */}
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

          <ToolMergeVisibleAnnotations baseMap={baseMap} onResult={handleTransformResult} />
        </List>
      </Box>

      {/* SMART TRANSFORM MENU */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleCloseMenu}
      >
        {!activeTransform?.isDefault && (
          <MenuItem
            onClick={() => {
              handleCloseMenu();
              setOpenEditTransform(true);
            }}
          >
            <Edit fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
            <Typography>Modifier</Typography>
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            handleCloseMenu();
            setDuplicateTransform({
              name: activeTransform?.name,
              prompt: activeTransform?.prompt,
            });
            setOpenCreateTransform(true);
          }}
        >
          <ContentCopy fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
          <Typography>Dupliquer</Typography>
        </MenuItem>
        {!activeTransform?.isDefault && (
          <MenuItem
            onClick={() => {
              handleCloseMenu();
              setOpenDeleteTransform(true);
            }}
          >
            <Delete fontSize="small" sx={{ mr: 1, color: "error.main" }} />
            <Typography color="error">Supprimer</Typography>
          </MenuItem>
        )}
      </Menu>

      {/* COMPARE DIALOG */}
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

      {/* SMART TRANSFORM DIALOGS */}
      <DialogCreateBaseMapTransform
        open={openCreateTransform}
        onClose={() => {
          setOpenCreateTransform(false);
          setDuplicateTransform(null);
        }}
        initialBaseMapTransform={duplicateTransform}
      />

      {activeTransform && (
        <DialogEditBaseMapTransform
          open={openEditTransform}
          onClose={() => {
            setOpenEditTransform(false);
            setActiveTransform(null);
          }}
          initialBaseMapTransform={activeTransform}
        />
      )}

      <DialogDeleteRessource
        open={openDeleteTransform}
        onClose={() => setOpenDeleteTransform(false)}
        onConfirmAsync={async () => {
          if (activeTransform) {
            const dbModule = await import("App/db/db");
            await dbModule.default.baseMapTransforms.delete(activeTransform.id);
          }
          setOpenDeleteTransform(false);
        }}
      />
    </>
  );
}
