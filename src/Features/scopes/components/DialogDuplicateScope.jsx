import { useState, useEffect } from "react";

import { Box, Typography } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

import useDuplicateScopeSourceData from "../hooks/useDuplicateScopeSourceData";
import useDuplicateScope from "../hooks/useDuplicateScope";
import useScopeOpeningSourceProject from "../hooks/useScopeOpeningSourceProject";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

import SectionDuplicateBaseMaps from "./SectionDuplicateBaseMaps";
import SectionDuplicateLayers from "./SectionDuplicateLayers";
import SectionDuplicateAnnotationTemplates from "./SectionDuplicateAnnotationTemplates";

export default function DialogDuplicateScope({ open, onClose, scope }) {
  // strings

  const titleS = "Dupliquer";
  const nameLabelS = "Nom";
  const annotationsS = "Annotations";
  const noAnnotationsS = "Aucune annotation à copier";
  const duplicateS = "Dupliquer";
  const targetProjectS = "La copie sera rattachée à :";
  const fullCopyS = "Copie complète, fonds de plan inclus.";

  // data

  const appConfig = useAppConfig();
  // scope opened from another project (Krto of a linked project): the copy
  // goes to that project, as a full copy
  const targetProject = useScopeOpeningSourceProject(open ? scope : null);
  const targetTypeLabel =
    appConfig?.strings?.project?.typeLabels?.[targetProject?.type];
  const targetProjectLabel = targetProject
    ? [targetProject.name, targetTypeLabel && `(${targetTypeLabel})`]
        .filter(Boolean)
        .join(" ")
    : null;

  const { value: sourceData, loading: sourceLoading } =
    useDuplicateScopeSourceData(open ? scope : null);
  const duplicateScope = useDuplicateScope();
  const spriteImage = useAnnotationSpriteImage();

  // state

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  // disabled = unchecked; empty arrays = everything checked (default)
  const [disabledBaseMapIds, setDisabledBaseMapIds] = useState([]);
  const [disabledLayerIds, setDisabledLayerIds] = useState([]);
  const [disabledTemplateKeys, setDisabledTemplateKeys] = useState([]);

  useEffect(() => {
    if (open) {
      setName((scope?.name ?? "") + " (copie)");
      setDisabledBaseMapIds([]);
      setDisabledLayerIds([]);
      setDisabledTemplateKeys([]);
    }
  }, [open, scope?.id]);

  // helpers

  const disabled = !name.trim() || loading || sourceLoading;

  // helpers - toggle

  const toggleIn = (setter) => (key) =>
    setter((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  // handlers

  function handleClose() {
    if (loading) return; // block closing while duplicating
    onClose();
  }

  async function handleDuplicate() {
    if (loading || disabled) return;
    setLoading(true);
    try {
      await duplicateScope({
        scope,
        name,
        disabledBaseMapIds,
        disabledLayerIds,
        disabledTemplateKeys,
        targetProjectId: targetProject?.id,
      });
      onClose();
    } catch (error) {
      console.error("[DialogDuplicateScope] duplication failed", error);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !disabled) {
      handleDuplicate();
    }
  }

  // render

  if (!open) return null;

  return (
    <DialogGeneric
      open={open}
      onClose={handleClose}
      width="400px"
      title={titleS}
    >
      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <Box
          sx={{
            px: 1,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            pointerEvents: loading ? "none" : "auto",
            opacity: loading ? 0.6 : 1,
          }}
        >
          <Box onKeyDown={handleKeyDown}>
            <FieldTextV2
              label={nameLabelS}
              value={name}
              onChange={(v) => setName(v)}
              options={{ fullWidth: true, showLabel: true, autoFocus: true }}
            />
          </Box>

          {targetProject && (
            <Box>
              <Typography variant="body2">
                {targetProjectS} <b>{targetProjectLabel}</b>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {fullCopyS}
              </Typography>
            </Box>
          )}

          {!targetProject && (
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {annotationsS}
            </Typography>
          )}

          {!targetProject && sourceData?.annotationsCount === 0 && (
            <Typography variant="caption" color="text.secondary">
              {noAnnotationsS}
            </Typography>
          )}

          {!targetProject && sourceData && sourceData.annotationsCount > 0 && (
            <>
              <SectionDuplicateBaseMaps
                baseMaps={sourceData.baseMaps}
                countByBaseMapId={sourceData.countByBaseMapId}
                disabledBaseMapIds={disabledBaseMapIds}
                onToggleBaseMap={toggleIn(setDisabledBaseMapIds)}
              />
              <SectionDuplicateLayers
                layers={sourceData.layers}
                hasRealLayers={sourceData.hasRealLayers}
                countByLayerKey={sourceData.countByLayerKey}
                hasAnnotationsWithoutLayer={
                  sourceData.hasAnnotationsWithoutLayer
                }
                disabledLayerIds={disabledLayerIds}
                onToggleLayer={toggleIn(setDisabledLayerIds)}
              />
              <SectionDuplicateAnnotationTemplates
                listings={sourceData.listings}
                templatesByListingId={sourceData.templatesByListingId}
                countByTemplateKey={sourceData.countByTemplateKey}
                disabledTemplateKeys={disabledTemplateKeys}
                onToggleTemplateKey={toggleIn(setDisabledTemplateKeys)}
                spriteImage={spriteImage}
              />
            </>
          )}
        </Box>
      </BoxFlexVStretch>

      <ButtonInPanelV2
        label={duplicateS}
        onClick={handleDuplicate}
        variant="contained"
        loading={loading}
        disabled={disabled}
      />
    </DialogGeneric>
  );
}
