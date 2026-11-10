import { useState } from "react";

import { useLiveQuery } from "dexie-react-hooks";

import { Box, Button, Menu, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import FieldNumberWithUnit from "Features/form/components/FieldNumberWithUnit";
import ListPickAnnotationTemplate from "Features/commandsToolbar/components/ListPickAnnotationTemplate";

import db from "App/db/db";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";

import { getObject3DLengthFromOrigin } from "../utils/getObject3DLengthAxis";

const DEFAULT_STEP_M = 1;
const MIN_STEP_M = 0.01;
// Shapes a path array can repeat: 2-point segments or GLB objects.
const ELIGIBLE_SHAPES = ["POLYLINE", "OBJECT_3D"];

const filterTemplate = (template) =>
  ELIGIBLE_SHAPES.includes(resolveDrawingShape(template));

// « Calepinage » white section of a POLYLINE (annotation properties panel):
// the path array settings stored on the annotation — `pathArray = { step (m),
// annotationTemplateId }`. The elements themselves (one annotation per piece
// of `step`, chord by chord along the line) are generated and kept in sync by
// usePathArraySync; this section only edits the settings.
// Self-hiding on the generated elements.
export default function SectionAnnotationPathArray({ annotation }) {
  // strings

  const titleS = "Calepinage";
  const stepS = "Longueur";
  const pickTemplateS = "Choisir un modèle…";
  const emptyS = "Aucun modèle de polyligne ou d'objet 3D";
  const removeS = "Supprimer le calepinage";
  const countS = (n) => (n > 1 ? `${n} éléments` : `${n} élément`);
  const helperS =
    "Répète un modèle le long de la ligne, par cordes de cette longueur.";

  // data

  const updateAnnotation = useUpdateAnnotation();
  const annotationId = annotation?.id;

  // The stored row: the settings and the count written back by the sync.
  const row = useLiveQuery(
    () => (annotationId ? db.annotations.get(annotationId) : null),
    [annotationId]
  );
  const pathArray = row?.pathArray ?? null;
  const templateId = pathArray?.annotationTemplateId ?? null;
  const template = useLiveQuery(
    () => (templateId ? db.annotationTemplates.get(templateId) : null),
    [templateId]
  );

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const hasTemplate = Boolean(templateId);
  const count = pathArray?.appliedCount;

  // handlers

  async function handleTemplateChange(id, pickedTemplate) {
    setAnchorEl(null);
    if (!id || !annotationId) return;
    // First setup with a GLB: one object per step by default.
    const objectLength =
      resolveDrawingShape(pickedTemplate) === "OBJECT_3D"
        ? getObject3DLengthFromOrigin(pickedTemplate?.object3D)
        : null;
    const step =
      Number(pathArray?.step) > 0
        ? Number(pathArray.step)
        : (objectLength ?? DEFAULT_STEP_M);
    await updateAnnotation({
      id: annotationId,
      pathArray: { ...(pathArray ?? {}), step, annotationTemplateId: id },
    });
  }

  async function handleStepChange(value) {
    const step = Number(value);
    if (!annotationId || !Number.isFinite(step) || step < MIN_STEP_M) return;
    if (step === Number(pathArray?.step)) return;
    await updateAnnotation({
      id: annotationId,
      pathArray: { ...(pathArray ?? {}), step },
    });
  }

  async function handleRemove() {
    if (!annotationId) return;
    // undefined drops the key; the sync then deletes the elements.
    await updateAnnotation({ id: annotationId, pathArray: undefined });
  }

  // render

  if (!annotationId || annotation.type !== "POLYLINE") return null;
  if (
    annotation.pathArraySourceAnnotationId ||
    row?.pathArraySourceAnnotationId
  )
    return null;

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        <WhiteSectionTitle>{titleS}</WhiteSectionTitle>
        <Typography variant="caption" color="text.secondary">
          {helperS}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ justifyContent: "flex-start", textTransform: "none" }}
        >
          {hasTemplate ? (template?.label ?? "…") : pickTemplateS}
        </Button>
        {Boolean(anchorEl) && (
          <Menu
            open
            anchorEl={anchorEl}
            onClose={() => setAnchorEl(null)}
            slotProps={{ paper: { sx: { maxHeight: 360, width: 320 } } }}
          >
            <ListPickAnnotationTemplate
              filterTemplate={filterTemplate}
              selectedAnnotationTemplateId={templateId}
              onChange={handleTemplateChange}
              emptyText={emptyS}
            />
          </Menu>
        )}
        {hasTemplate && (
          <>
            <FieldNumberWithUnit
              label={stepS}
              unit="m"
              value={pathArray?.step ?? ""}
              onChange={handleStepChange}
            />
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {Number.isInteger(count) ? countS(count) : ""}
              </Typography>
              <Button
                size="small"
                color="inherit"
                startIcon={<DeleteOutlineIcon />}
                onClick={handleRemove}
                sx={{ textTransform: "none" }}
              >
                {removeS}
              </Button>
            </Box>
          </>
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
