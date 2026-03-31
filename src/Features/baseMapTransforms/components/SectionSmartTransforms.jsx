import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { setEnhancingBaseMap } from "Features/baseMaps/baseMapsSlice";

import useBaseMapTransforms from "../hooks/useBaseMapTransforms";
import useCreateBaseMapVersion from "Features/baseMaps/hooks/useCreateBaseMapVersion";
import useReplaceVersionImage from "Features/baseMaps/hooks/useReplaceVersionImage";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

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
} from "@mui/material";
import {
  Add as AddIcon,
  MoreVert,
  Edit,
  Delete,
  Stop,
  ContentCopy,
} from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";
import DialogEditBaseMapTransform from "./DialogEditBaseMapTransform";
import DialogCreateBaseMapTransform from "./DialogCreateBaseMapTransform";
import SectionCompareTwoImages from "./SectionCompareTwoImages";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import enhanceBaseMapService, {
  cancelEnhanceBaseMap,
} from "Features/baseMaps/services/enhanceBaseMapService";

export default function SectionSmartTransforms({ baseMap }) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const baseMapTransforms = useBaseMapTransforms();
  const createVersion = useCreateBaseMapVersion();
  const replaceVersionImage = useReplaceVersionImage();

  const enhancingBaseMap = useSelector(
    (s) => s.baseMaps?.enhancingBaseMapIds?.[baseMap?.id]
  );
  const enhancingTransformId = enhancingBaseMap?.transformId;

  // helpers

  const activeVersion = baseMap?.getActiveVersion?.();
  const versionUrl = baseMap?.getUrl?.();

  // state

  const [tempResult, setTempResult] = useState(null);
  const [openCompare, setOpenCompare] = useState(false);
  const [createNewVersion, setCreateNewVersion] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [activeTransform, setActiveTransform] = useState(null);
  const [openEditTransform, setOpenEditTransform] = useState(false);
  const [openDeleteTransform, setOpenDeleteTransform] = useState(false);
  const [openCreateTransform, setOpenCreateTransform] = useState(false);
  const [duplicateTransform, setDuplicateTransform] = useState(null);

  // handlers

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

  function handleSmartTransformClick(transform) {
    if (!activeVersion?.image?.file || !baseMap?.id) return;
    if (enhancingTransformId) return;

    enhanceBaseMapService({
      baseMapId: baseMap.id,
      transformId: transform.id,
      file: activeVersion.image.file,
      prompt: transform.prompt,
      serviceUrl: appConfig?.features?.enhanceBaseMap?.fetchParams?.url,
      dispatch,
      onSuccess: ({ blob }) => {
        const file = new File([blob], "enhanced.png", { type: "image/png" });
        handleTransformResult(file, transform.name || "Smart transform");
      },
      onError: () => {},
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
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 1.5,
            pt: 1,
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
          {baseMapTransforms?.map((transform, index) => {
            const isEnhancingThis = enhancingTransformId === transform.id;
            const isLast = index === baseMapTransforms.length - 1;
            return (
              <ListItem
                key={transform.id}
                disablePadding
                divider={!isLast}
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
                  disabled={!!enhancingTransformId && !isEnhancingThis}
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

      {/* Menu */}
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

      {/* Dialogs */}
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
