import { useCallback, useRef, useState } from "react";

import { useLiveQuery } from "dexie-react-hooks";

import { Box, Button, Menu, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldNumberWithUnit from "Features/form/components/FieldNumberWithUnit";
import ListPickAnnotationTemplate from "Features/commandsToolbar/components/ListPickAnnotationTemplate";

import db from "App/db/db";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";

import { getObject3DLengthFromOrigin } from "../utils/getObject3DLengthAxis";

const DEFAULT_STEP_M = 1;
const MIN_STEP_M = 0.01;
// Shapes a path array can repeat: 2-point segments or GLB objects.
const ELIGIBLE_SHAPES = ["POLYLINE", "OBJECT_3D"];

// « Calepinage » field of a POLYLINE annotation template: the default path
// array of the lines drawn with it — `template.pathArray = { step (m),
// annotationTemplateId }`. usePathArraySync lays it on every line of the
// template and keeps them aligned until a line gets its own settings
// (SectionAnnotationPathArray).
export default function FieldAnnotationTemplatePathArray({
  value,
  onChange,
  annotationTemplateId,
}) {
  // strings

  const titleS = "Calepinage";
  const stepS = "Longueur";
  const pickTemplateS = "Choisir un modèle…";
  const emptyS = "Aucun modèle de polyligne ou d'objet 3D";
  const removeS = "Supprimer";
  const helperS =
    "Les lignes dessinées avec ce modèle répètent le modèle choisi, par cordes de cette longueur.";

  // data

  const elementTemplateId = value?.annotationTemplateId ?? null;
  const elementTemplate = useLiveQuery(
    () =>
      elementTemplateId ? db.annotationTemplates.get(elementTemplateId) : null,
    [elementTemplateId]
  );

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  // The template list loads AFTER the menu opened: re-position the popover
  // once the rows are in (same as SectionAnnotationPathArray).
  const menuActionRef = useRef(null);
  const menuObserverRef = useRef(null);
  const menuContentRef = useCallback((node) => {
    menuObserverRef.current?.disconnect();
    menuObserverRef.current = null;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      menuActionRef.current?.updatePosition()
    );
    observer.observe(node);
    menuObserverRef.current = observer;
  }, []);

  // helpers

  const hasTemplate = Boolean(elementTemplateId);
  const filterTemplate = (template) =>
    template.id !== annotationTemplateId &&
    ELIGIBLE_SHAPES.includes(resolveDrawingShape(template));

  // handlers

  function handleTemplateChange(id, pickedTemplate) {
    setAnchorEl(null);
    if (!id) return;
    // First setup with a GLB: one object per step by default.
    const objectLength =
      resolveDrawingShape(pickedTemplate) === "OBJECT_3D"
        ? getObject3DLengthFromOrigin(pickedTemplate?.object3D)
        : null;
    const step =
      Number(value?.step) > 0
        ? Number(value.step)
        : (objectLength ?? DEFAULT_STEP_M);
    onChange({ step, annotationTemplateId: id });
  }

  function handleStepChange(nextValue) {
    const step = Number(nextValue);
    if (!Number.isFinite(step) || step < MIN_STEP_M) return;
    if (step === Number(value?.step)) return;
    onChange({ ...(value ?? {}), step });
  }

  function handleRemove() {
    onChange(null);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {titleS}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {helperS}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ justifyContent: "flex-start", textTransform: "none" }}
        >
          {hasTemplate ? (elementTemplate?.label ?? "…") : pickTemplateS}
        </Button>
        {Boolean(anchorEl) && (
          <Menu
            open
            anchorEl={anchorEl}
            onClose={() => setAnchorEl(null)}
            action={menuActionRef}
            slotProps={{
              paper: {
                sx: {
                  maxHeight: "min(360px, calc(100vh - 32px))",
                  width: 320,
                },
              },
            }}
          >
            <Box ref={menuContentRef}>
              <ListPickAnnotationTemplate
                filterTemplate={filterTemplate}
                selectedAnnotationTemplateId={elementTemplateId}
                onChange={handleTemplateChange}
                emptyText={emptyS}
              />
            </Box>
          </Menu>
        )}
        {hasTemplate && (
          <>
            <FieldNumberWithUnit
              label={stepS}
              unit="m"
              value={value?.step ?? ""}
              onChange={handleStepChange}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
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
