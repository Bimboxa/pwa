import { useEffect, useMemo, useState } from "react";

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
import useCloneAnnotation3d from "Features/mapEditor/hooks/useCloneAnnotation3d";
import useCloneAnnotationAndEntity from "Features/mapEditor/hooks/useCloneAnnotationAndEntity";

import SelectorAnnotationTemplateVariantDense from "Features/annotations/components/SelectorAnnotationTemplateVariantDense";
import DialogDuplicateContourSegments from "Features/annotations/components/DialogDuplicateContourSegments";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";
import getCloneAnnotationPartState from "Features/annotations/utils/getCloneAnnotationPartState";
import getCloneTypeOptions from "Features/annotations/utils/getCloneTypeOptions";
import {
  resolveDrawingShape,
  resolveDrawingShapeFromType,
  getAnnotationType,
} from "Features/annotations/constants/drawingShapeConfig";

// "Dupliquer" flow of ONE selected annotation, anchored on the button that
// launched it (ButtonClone of the commands toolbar): the clone menu (target
// type, strip position, keep-original-points, template list) or, for contour
// segments of a sloped POLYGON, the wall-piece chooser
// (DialogDuplicateContourSegments). Part-aware: with segments / an opening /
// a guide sub-selected, the part is cloned instead of the whole annotation. A
// single selected vertex is not a clonable part — the whole annotation is
// duplicated. `selectedAnnotation` / `selectedPart` come from the toolbar
// context (already resolved). `mesh3dParts` ({ faceIndices, edges }): the
// faces / edges selected in 3D (second click, double-click on a block,
// shift+clicks) — the clone then builds one surface per face or one line per
// edge (the closed contour of each face when no edge is selected); a 3D line
// / surface off its plan is likewise re-encoded through the 3D drawing
// commits (useCloneAnnotation3d) before the plain point copy.
export default function CloneAnnotationFlow({
  open,
  onClose,
  anchorEl,
  accentColor,
  menuAlign = "left",
  selectedAnnotation,
  selectedPart,
  mesh3dParts = null,
}) {
  // data

  const part = selectedPart?.kind === "POINT" ? null : selectedPart;
  const cloneAnnotationAndEntity = useCloneAnnotationAndEntity();
  const cloneAnnotation3d = useCloneAnnotation3d();
  // Selected faces / edges are cloned as lines or surfaces whatever their
  // host is (a mesh only accepts POLYGON models otherwise): candidates of a
  // plain POLYGON.
  const candidatesReference = useMemo(
    () =>
      mesh3dParts && selectedAnnotation
        ? { ...selectedAnnotation, isMesh3d: false, type: "POLYGON" }
        : selectedAnnotation,
    [mesh3dParts, selectedAnnotation]
  );
  const { candidates: cloneCandidates, listings: cloneListings } =
    useAnnotationTemplateCandidates(candidatesReference) ?? {};

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

  // A 2D part (segments, opening…) wins over the 3D parts.
  const parts3d = hasPart ? null : mesh3dParts;
  const faceCount = parts3d?.faceIndices?.length ?? 0;
  const edgeCount = parts3d?.edges?.length ?? 0;
  const cloneTypeOptions = getCloneTypeOptions(selectedAnnotation?.type, part, {
    mesh3dParts: parts3d,
  });
  // One face alone keeps its historical default (its closed contour);
  // several faces — the block of a double-click — default to surfaces.
  const defaultCloneType = parts3d
    ? faceCount > 1 || (faceCount === 1 && edgeCount > 0)
      ? "POLYGON"
      : "POLYLINE"
    : hasPart
      ? part.targetAnnotationType || cloneTypeOptions?.[0]?.key
      : selectedAnnotation?.type;
  const cloneType = selectedCloneType ?? defaultCloneType;

  // What the 3D parts become with the current target type.
  const plural = (count, one, many) =>
    count > 1 ? `${count} ${many}` : `1 ${one}`;
  const parts3dHint = !parts3d
    ? null
    : cloneType === "POLYGON"
      ? `${plural(faceCount, "surface", "surfaces")} : une par face sélectionnée`
      : edgeCount > 0
        ? `${plural(edgeCount, "ligne", "lignes")} : une par arête sélectionnée`
        : `${plural(faceCount, "contour fermé", "contours fermés")} : un par face sélectionnée`;

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

    // 3D line ↔ surface (and the selected faces / edges): the 3D drawing
    // commits.
    const handledIn3d = await cloneAnnotation3d(selectedAnnotation, {
      template,
      cloneType,
      mesh3dParts: parts3d,
      keepOriginalPoints,
    });
    if (handledIn3d) {
      onClose?.();
      return;
    }

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
                  setSelectedCloneType(
                    v ?? (parts3d ? defaultCloneType : selectedAnnotation?.type)
                  )
                }
              />
              {parts3dHint && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.75 }}
                >
                  {parts3dHint}
                </Typography>
              )}
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
