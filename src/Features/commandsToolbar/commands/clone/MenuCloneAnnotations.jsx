import { useEffect, useState } from "react";

import {
  Box,
  Checkbox,
  FormControlLabel,
  Menu,
  Typography,
} from "@mui/material";
import {
  VerticalAlignTop as TopIcon,
  VerticalAlignBottom as BottomIcon,
} from "@mui/icons-material";

import useAnnotationTemplateCandidates from "Features/annotations/hooks/useAnnotationTemplateCandidates";
import useCloneAnnotationsAndEntities from "Features/mapEditor/hooks/useCloneAnnotationsAndEntities";

import SelectorAnnotationTemplateVariantDense from "Features/annotations/components/SelectorAnnotationTemplateVariantDense";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";
import getCloneTypeOptions from "Features/annotations/utils/getCloneTypeOptions";
import {
  getAnnotationType,
  resolveDrawingShape,
  resolveDrawingShapeFromType,
} from "Features/annotations/constants/drawingShapeConfig";

// "Dupliquer" menu of SEVERAL selected annotations (the former clone menu of
// ToolbarEditAnnotations): target type, strip position, keep-original-points
// and the template list (candidates of the first selected annotation), then
// useCloneAnnotationsAndEntities on the whole selection.
export default function MenuCloneAnnotations({
  open,
  onClose,
  anchorEl,
  annotations,
}) {
  // data

  const firstAnnotation = annotations[0];
  const cloneAnnotationsAndEntities = useCloneAnnotationsAndEntities();
  const { candidates: cloneCandidates, listings: cloneListings } =
    useAnnotationTemplateCandidates(firstAnnotation) ?? {};

  // state

  const [selectedCloneType, setSelectedCloneType] = useState(null);
  const [stripElevation, setStripElevation] = useState("TOP");
  const [keepOriginalPoints, setKeepOriginalPoints] = useState(false);

  useEffect(() => {
    if (open) setSelectedCloneType(firstAnnotation?.type ?? null);
  }, [open, firstAnnotation?.type]);

  // helpers

  const cloneTypeOptions = getCloneTypeOptions(firstAnnotation?.type);
  const showStripElevation =
    selectedCloneType === "STRIP" && firstAnnotation?.type === "POLYLINE";

  const filteredCloneCandidates = (() => {
    if (!cloneCandidates || !selectedCloneType) return cloneCandidates;
    if (selectedCloneType === "STRIP") return cloneCandidates;
    const targetDrawingShape = resolveDrawingShapeFromType(selectedCloneType);
    if (!targetDrawingShape) return cloneCandidates;
    return cloneCandidates.filter(
      (t) => resolveDrawingShape(t) === targetDrawingShape
    );
  })();

  // handlers

  async function handleCloneTemplateChange(annotationTemplateId) {
    const template = filteredCloneCandidates?.find(
      (t) => t.id === annotationTemplateId
    );
    const newAnnotation = {
      ...getAnnotationTemplateProps(template),
      annotationTemplateId: template?.id,
      label: template?.label,
      listingId: template?.listingId,
    };
    const resolvedShape = resolveDrawingShape(template);
    const resolvedType = getAnnotationType(resolvedShape);
    if (resolvedType) newAnnotation.type = resolvedType;
    if (selectedCloneType) newAnnotation.type = selectedCloneType;

    await cloneAnnotationsAndEntities(annotations, {
      newAnnotation,
      ...(showStripElevation ? { stripElevation } : {}),
      keepOriginalPoints,
    });
    onClose?.();
  }

  // render

  return (
    <Menu
      open={Boolean(open && anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
    >
      {cloneTypeOptions && (
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
            Type de l'annotation dupliquée
          </Typography>
          <ToggleSingleSelectorGeneric
            selectedKey={selectedCloneType}
            options={cloneTypeOptions}
            onChange={(v) => setSelectedCloneType(v ?? firstAnnotation?.type)}
          />
        </Box>
      )}
      {showStripElevation && (
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
            Position de la bande
          </Typography>
          <ToggleSingleSelectorGeneric
            selectedKey={stripElevation}
            options={[
              { key: "TOP", label: "Haut", icon: <TopIcon /> },
              { key: "BOTTOM", label: "Bas", icon: <BottomIcon /> },
            ]}
            onChange={(v) => setStripElevation(v ?? "TOP")}
          />
        </Box>
      )}
      <Box sx={{ px: 2, py: 0.5 }}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={keepOriginalPoints}
              onChange={(e) => setKeepOriginalPoints(e.target.checked)}
            />
          }
          label={
            <Typography variant="body2">
              Conserver les points d'origine
            </Typography>
          }
        />
      </Box>
      <SelectorAnnotationTemplateVariantDense
        selectedAnnotationTemplateId={firstAnnotation?.annotationTemplateId}
        onChange={handleCloneTemplateChange}
        annotationTemplates={filteredCloneCandidates}
        listings={cloneListings}
      />
    </Menu>
  );
}
