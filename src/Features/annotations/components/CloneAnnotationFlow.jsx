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

import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import useSelectedAnnotationPart from "../hooks/useSelectedAnnotationPart";
import useAnnotationTemplateCandidates from "../hooks/useAnnotationTemplateCandidates";
import useCloneAnnotationAndEntity from "Features/mapEditor/hooks/useCloneAnnotationAndEntity";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import DialogDuplicateContourSegments from "./DialogDuplicateContourSegments";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";
import getCloneAnnotationPartState from "../utils/getCloneAnnotationPartState";
import getCloneTypeOptions from "../utils/getCloneTypeOptions";
import {
  resolveDrawingShape,
  resolveDrawingShapeFromType,
  getAnnotationType,
} from "../constants/drawingShapeConfig";

// "Dupliquer" flow of the selected annotation, anchored on the button that
// launched it (ButtonCloneAnnotation): the clone menu (target type, strip
// position, keep-original-points, template list) or, for contour segments of
// a sloped POLYGON, the wall-piece chooser (DialogDuplicateContourSegments).
// Part-aware: with segments / an opening / a guide sub-selected, the part is
// cloned instead of the whole annotation. A single selected vertex is not a
// clonable part — the whole annotation is duplicated.
export default function CloneAnnotationFlow({
  open,
  onClose,
  anchorEl,
  accentColor,
  menuAlign = "right",
}) {
  // data

  const selectedAnnotation = useSelectedAnnotation();
  const selectedPart = useSelectedAnnotationPart();
  const part = selectedPart?.kind === "POINT" ? null : selectedPart;
  const cloneAnnotationAndEntity = useCloneAnnotationAndEntity();
  const { candidates: cloneCandidates, listings: cloneListings } =
    useAnnotationTemplateCandidates(selectedAnnotation) ?? {};

  // state

  // null = default type for the current selection (see defaultCloneType)
  const [selectedCloneType, setSelectedCloneType] = useState(null);
  const [stripElevation, setStripElevation] = useState("TOP");
  const [keepOriginalPoints, setKeepOriginalPoints] = useState(false);

  useEffect(() => {
    if (open) setSelectedCloneType(null);
  }, [open]);

  // helpers

  const { hasPart, disabled, tooltip } = getCloneAnnotationPartState(part);

  const cloneTypeOptions = getCloneTypeOptions(selectedAnnotation?.type, part);
  const defaultCloneType = hasPart
    ? part.targetAnnotationType || cloneTypeOptions?.[0]?.key
    : selectedAnnotation?.type;
  const cloneType = selectedCloneType ?? defaultCloneType;

  const showStripElevation =
    cloneType === "STRIP" && selectedAnnotation?.type === "POLYLINE";

  // A sloped POLYGON with contour segments selected: "Dupliquer" offers the
  // wall-generation chooser (mur droit / hauteur fixe / hauteur max) so the user
  // can create bouts de parois — see DialogDuplicateContourSegments.
  const isSlopedPolygon =
    selectedAnnotation?.type === "POLYGON" &&
    selectedAnnotation?.guideLines?.some(
      (g) => g?.points?.length >= 2 && g?.slopePct
    );
  const offersWallChooser =
    isSlopedPolygon &&
    hasPart &&
    (part.kind === "SEGMENTS" || part.kind === "SEGMENT");

  // Filter clone candidates based on selected clone type
  const filteredCloneCandidates = (() => {
    if (!cloneCandidates || !cloneType) return cloneCandidates;
    // STRIP shows all compatible templates (polyline + polygon)
    if (cloneType === "STRIP") return cloneCandidates;
    const targetDrawingShape = resolveDrawingShapeFromType(cloneType);
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

    // Override type if user selected a different one
    if (cloneType) newAnnotation.type = cloneType;

    await cloneAnnotationAndEntity(selectedAnnotation, {
      newAnnotation,
      part: hasPart ? part : undefined,
      ...(showStripElevation ? { stripElevation } : {}),
      keepOriginalPoints,
    });
    onClose?.();
  }

  // render

  if (!selectedAnnotation) return null;

  // Wall-piece chooser (sloped polygon + segments selected) — it keeps the
  // plain "Copie simple" too.
  if (offersWallChooser && !disabled) {
    if (!open) return null;
    return (
      <DialogDuplicateContourSegments
        open
        onClose={onClose}
        annotation={selectedAnnotation}
        part={part}
        accentColor={accentColor}
      />
    );
  }

  return (
    <Menu
      open={Boolean(open && anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: menuAlign }}
      transformOrigin={{ vertical: "top", horizontal: menuAlign }}
    >
      {disabled ? (
        <Box sx={{ px: 2, py: 1, maxWidth: 280 }}>
          <Typography variant="body2" color="text.secondary">
            {tooltip ??
              "La sélection en cours ne peut pas être dupliquée. Sélectionnez l'annotation entière ou des segments."}
          </Typography>
        </Box>
      ) : (
        [
          cloneTypeOptions && (
            <Box key="type" sx={{ px: 2, py: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                Type de l'annotation dupliquée
              </Typography>
              <ToggleSingleSelectorGeneric
                selectedKey={cloneType}
                options={cloneTypeOptions}
                onChange={(v) =>
                  setSelectedCloneType(v ?? selectedAnnotation?.type)
                }
              />
            </Box>
          ),
          showStripElevation && (
            <Box key="stripElevation" sx={{ px: 2, py: 1 }}>
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
          ),
          <Box key="keepOriginalPoints" sx={{ px: 2, py: 0.5 }}>
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
          </Box>,
          <SelectorAnnotationTemplateVariantDense
            key="templates"
            selectedAnnotationTemplateId={
              selectedAnnotation?.annotationTemplateId
            }
            onChange={handleCloneTemplateChange}
            annotationTemplates={filteredCloneCandidates}
            listings={cloneListings}
          />,
        ]
      )}
    </Menu>
  );
}
