import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";

import {
  setLinkingBusinessObjectId,
  triggerRelsBusinessObjectAnnotationUpdate,
} from "../businessObjectsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { Box, IconButton, InputBase, Tooltip, Typography } from "@mui/material";
import { Add } from "@mui/icons-material";

import db from "App/db/db";

import useUpdateBusinessObject from "../hooks/useUpdateBusinessObject";
import useLinkAnnotationsToBusinessObject from "../hooks/useLinkAnnotationsToBusinessObject";
import useLinkTemplatesToBusinessObject from "../hooks/useLinkTemplatesToBusinessObject";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import CardBusinessObjectTemplateQty from "./CardBusinessObjectTemplateQty";
import DialogLinkBusinessObjectAnnotations from "./DialogLinkBusinessObjectAnnotations";

import getBusinessObjectQtiesByTemplate from "../utils/getBusinessObjectQtiesByTemplate";
import getBusinessObjectQtyValue from "../utils/getBusinessObjectQtyValue";
import getBusinessObjectQtyGap from "../utils/getBusinessObjectQtyGap";
import { getBusinessObjectUnitLabel } from "../utils/getBusinessObjectQtyLabel";
import formatBusinessObjectNumber from "../utils/formatBusinessObjectNumber";
import setQtyFormulaForTemplate from "../utils/setQtyFormulaForTemplate";
import { getDefaultQtyFormula, getQtyFormulaKey } from "../utils/qtyFormula";
import { parseHoursRatioInput } from "../utils/hoursRatioConversions";

function getRefQtyText(refQty) {
  return Number.isFinite(refQty) ? formatBusinessObjectNumber(refQty, 3) : "";
}

// Content of the "Quantités" tab of the business object properties: the
// quantity summary (computed from the annotations feeding the object,
// reference quantity — editable, saved on blur — and gap — absolute +
// percentage) then one card per annotation template
// (CardBusinessObjectTemplateQty). The "+" of the "Annotations liées"
// heading opens DialogLinkBusinessObjectAnnotations: link "Par annotation"
// (picking mode, rels) or "Par modèle" (whole-template link,
// businessObject.linkedTemplateIds). The cards cover every annotation
// feeding the object, the MAIN ones ("Localisation") included — the rollup
// counts both.
// linkedRows: [{annotation, rel | null, byAnnotation, byTemplate}]
// (resolveBusinessObjectAnnotationLinks); annotations: every annotation in
// scope (for the "link all" action and the template picker); unit: the unit
// the quantity is read in (the ratio unit for a task); showRefQty: false for
// the types without reference quantity (tasks).
export default function SectionBusinessObjectQuantities({
  businessObject,
  unit,
  showRefQty,
  linkedRows,
  annotations,
  annotationTemplateById,
  spriteImage,
  emptyLabel,
  onOpenTemplate,
}) {
  const dispatch = useDispatch();

  // strings

  const computedS = "Quantité calculée";
  const refS = "Quantité de référence";
  const gapS = "Écart";
  const templatesS = "Annotations liées";
  const addLinkS = "Lier des annotations";

  // data

  const updateBusinessObject = useUpdateBusinessObject();
  const linkAnnotations = useLinkAnnotationsToBusinessObject();
  const { linkTemplates, unlinkTemplate } = useLinkTemplatesToBusinessObject();

  // state — reference quantity text ("" = none), committed on blur

  const [refQtyText, setRefQtyText] = useState("");

  useEffect(() => {
    setRefQtyText(getRefQtyText(businessObject.refQty));
  }, [businessObject.id, businessObject.refQty]);

  // state — link dialog

  const [openLinkDialog, setOpenLinkDialog] = useState(false);

  // helpers — rels of the rows linked by annotation

  const relByAnnotationId = useMemo(() => {
    const byId = {};
    (linkedRows ?? []).forEach(({ annotation, rel }) => {
      if (rel) byId[annotation.id] = rel;
    });
    return byId;
  }, [linkedRows]);

  const relAnnotationIds = useMemo(
    () => new Set(Object.keys(relByAnnotationId)),
    [relByAnnotationId]
  );

  // every annotation feeding the object (both link kinds)
  const linkedAnnotationIdSet = useMemo(
    () => new Set((linkedRows ?? []).map(({ annotation }) => annotation.id)),
    [linkedRows]
  );

  // one row per template; the empty row seeded for a linked template whose
  // template no longer exists is hidden
  const rows = useMemo(
    () =>
      getBusinessObjectQtiesByTemplate(
        (linkedRows ?? []).map(({ annotation }) => annotation),
        businessObject,
        { relAnnotationIds }
      ).filter(
        (row) =>
          row.annotations.length > 0 ||
          Boolean(annotationTemplateById?.[row.annotationTemplateId])
      ),
    [linkedRows, businessObject, relAnnotationIds, annotationTemplateById]
  );

  // annotations of each template not feeding the object yet (mesh cells
  // skipped: their parent is the one to link)
  const unlinkedIdsByKey = useMemo(() => {
    const byKey = {};
    (annotations ?? []).forEach((annotation) => {
      if (annotation.isMeshCell || linkedAnnotationIdSet.has(annotation.id))
        return;
      const key = getQtyFormulaKey(annotation.annotationTemplateId);
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push(annotation.id);
    });
    return byKey;
  }, [annotations, linkedAnnotationIdSet]);

  // helpers — summary: total = Σ of the template rows, in the object's unit

  const unitLabel = getBusinessObjectUnitLabel(unit);
  const format = (value) =>
    `${formatBusinessObjectNumber(value, 1)} ${unitLabel}`;

  const total = useMemo(() => {
    if (rows.length === 0) return getBusinessObjectQtyValue(unit, {});
    return rows.reduce((sum, row) => {
      const value = getBusinessObjectQtyValue(unit, row.qties);
      return value == null ? sum : (sum ?? 0) + value;
    }, null);
  }, [rows, unit]);

  const refQty = businessObject.refQty;
  const gap = rows.length > 0 ? getBusinessObjectQtyGap(total, refQty) : null;

  let gapValueS = "-";
  if (gap) {
    const sign = gap.delta > 0 ? "+" : "";
    const ratioS = Number.isFinite(gap.ratio)
      ? ` (${sign}${formatBusinessObjectNumber(
          Math.sign(gap.delta) * gap.ratio * 100,
          1
        )} %)`
      : "";
    gapValueS = `${sign}${format(gap.delta)}${ratioS}`;
  }

  const summary = [
    { label: computedS, value: total == null ? "-" : format(total) },
    ...(showRefQty
      ? [
          { label: refS, isRef: true },
          { label: gapS, value: gapValueS, isGap: true, isOver: gap?.isOver },
        ]
      : []),
  ];

  // handlers

  function handleRefQtyBlur() {
    // untouched text: the stored value (maybe more precise) is kept
    if (refQtyText === getRefQtyText(refQty)) return;
    const next = parseHoursRatioInput(refQtyText.replace(/\s/g, ""));
    if (next !== (refQty ?? null))
      updateBusinessObject(businessObject.id, { refQty: next });
    else setRefQtyText(getRefQtyText(next));
  }

  function handleRefQtyKeyDown(e) {
    if (e.key === "Enter") e.target.blur();
    if (e.key === "Escape") setRefQtyText(getRefQtyText(refQty));
  }

  function handleFormulaChange(annotationTemplateId, formula) {
    updateBusinessObject(businessObject.id, {
      qtyFormulas: setQtyFormulaForTemplate(
        businessObject.qtyFormulas,
        annotationTemplateId,
        formula,
        getDefaultQtyFormula(unit)
      ),
    });
  }

  function handleLinkAll(row) {
    const annotationIds =
      unlinkedIdsByKey[getQtyFormulaKey(row.annotationTemplateId)];
    if (!annotationIds?.length) return;
    linkAnnotations({ businessObject, annotationIds });
  }

  // linked by template: the template link goes first (a second click on a
  // row still linked by annotation then deletes the rels)
  async function handleUnlinkAll(row) {
    if (row.isLinkedByTemplate) {
      await unlinkTemplate({
        businessObject,
        annotationTemplateId: row.annotationTemplateId,
      });
      return;
    }
    const relIds = row.annotations
      .map((annotation) => relByAnnotationId[annotation.id]?.id)
      .filter(Boolean);
    if (relIds.length === 0) return;
    try {
      await db.relsBusinessObjectAnnotation.bulkDelete(relIds);
      dispatch(triggerRelsBusinessObjectAnnotationUpdate());
      dispatch(
        setToaster({
          message: `${relIds.length} annotation${
            relIds.length > 1 ? "s" : ""
          } déliée${relIds.length > 1 ? "s" : ""} de "${businessObject.label}"`,
        })
      );
    } catch (error) {
      console.error("[SectionBusinessObjectQuantities] unlink all", error);
      dispatch(
        setToaster({ message: error?.message ?? `${error}`, isError: true })
      );
    }
  }

  function handleLinkByAnnotation() {
    setOpenLinkDialog(false);
    dispatch(setLinkingBusinessObjectId(businessObject.id));
  }

  async function handleLinkByTemplate(annotationTemplateIds) {
    setOpenLinkDialog(false);
    const labelById = {};
    annotationTemplateIds.forEach((id) => {
      labelById[id] = annotationTemplateById?.[id]?.label;
    });
    await linkTemplates({ businessObject, annotationTemplateIds, labelById });
  }

  // render

  return (
    <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
      <WhiteSectionGeneric>
        {summary.map(({ label, value, isGap, isOver, isRef }) => (
          <Box
            key={label}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              py: 0.25,
              color: isOver ? "warning.main" : "text.primary",
            }}
          >
            <Typography
              variant="body2"
              color={isOver ? "inherit" : "text.secondary"}
            >
              {label}
            </Typography>
            {isRef ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <InputBase
                  value={refQtyText}
                  placeholder="-"
                  onChange={(e) => setRefQtyText(e.target.value)}
                  onBlur={handleRefQtyBlur}
                  onKeyDown={handleRefQtyKeyDown}
                  inputProps={{ "aria-label": label }}
                  sx={{
                    width: 90,
                    px: 0.5,
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    typography: "body2",
                    fontWeight: 600,
                    "&.Mui-focused": { borderColor: "primary.main" },
                    "& input": { p: 0.25, textAlign: "right" },
                  }}
                />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {unitLabel}
                </Typography>
              </Box>
            ) : (
              <Typography
                variant="body2"
                color="inherit"
                sx={{ fontWeight: isGap ? 400 : 600, whiteSpace: "nowrap" }}
              >
                {value}
              </Typography>
            )}
          </Box>
        ))}
      </WhiteSectionGeneric>

      {/* heading + "+" (link dialog) */}
      <Box sx={{ display: "flex", alignItems: "center", mt: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
          {templatesS}
        </Typography>
        <Tooltip title={addLinkS} placement="top" arrow>
          <IconButton size="small" onClick={() => setOpenLinkDialog(true)}>
            <Add fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyLabel}
        </Typography>
      ) : (
        rows.map((row) => (
          <CardBusinessObjectTemplateQty
            key={row.annotationTemplateId ?? "none"}
            row={row}
            template={annotationTemplateById[row.annotationTemplateId]}
            unit={unit}
            unlinkedCount={
              unlinkedIdsByKey[getQtyFormulaKey(row.annotationTemplateId)]
                ?.length ?? 0
            }
            spriteImage={spriteImage}
            onFormulaChange={handleFormulaChange}
            onLinkAll={handleLinkAll}
            onUnlinkAll={handleUnlinkAll}
            onOpen={(r) =>
              onOpenTemplate(getQtyFormulaKey(r.annotationTemplateId))
            }
          />
        ))
      )}

      {openLinkDialog && (
        <DialogLinkBusinessObjectAnnotations
          open={openLinkDialog}
          businessObject={businessObject}
          annotations={annotations}
          annotationTemplateById={annotationTemplateById}
          spriteImage={spriteImage}
          onClose={() => setOpenLinkDialog(false)}
          onLinkByAnnotation={handleLinkByAnnotation}
          onLinkByTemplate={handleLinkByTemplate}
        />
      )}
    </Box>
  );
}
