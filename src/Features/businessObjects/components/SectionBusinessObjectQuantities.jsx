import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";

import { triggerRelsBusinessObjectAnnotationUpdate } from "../businessObjectsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { Box, InputBase, Typography } from "@mui/material";

import db from "App/db/db";

import useUpdateBusinessObject from "../hooks/useUpdateBusinessObject";
import useLinkAnnotationsToBusinessObject from "../hooks/useLinkAnnotationsToBusinessObject";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import CardBusinessObjectTemplateQty from "./CardBusinessObjectTemplateQty";

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
// quantity summary (computed from the linked annotations, reference quantity
// — editable, saved on blur — and gap — absolute + percentage) then one card per linked annotation
// template (CardBusinessObjectTemplateQty). The cards cover every linked
// annotation, the MAIN ones ("Localisation") included — the rollup counts
// both.
// linkedRows: [{annotation, rel}]; annotations: every annotation in scope
// (for the "link all" action); unit: the unit the quantity is read in (the
// ratio unit for a task); showRefQty: false for the types without reference
// quantity (tasks).
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

  // data

  const updateBusinessObject = useUpdateBusinessObject();
  const linkAnnotations = useLinkAnnotationsToBusinessObject();

  // state — reference quantity text ("" = none), committed on blur

  const [refQtyText, setRefQtyText] = useState("");

  useEffect(() => {
    setRefQtyText(getRefQtyText(businessObject.refQty));
  }, [businessObject.id, businessObject.refQty]);

  // helpers

  const relByAnnotationId = useMemo(() => {
    const byId = {};
    (linkedRows ?? []).forEach(({ annotation, rel }) => {
      byId[annotation.id] = rel;
    });
    return byId;
  }, [linkedRows]);

  const rows = useMemo(
    () =>
      getBusinessObjectQtiesByTemplate(
        (linkedRows ?? []).map(({ annotation }) => annotation),
        businessObject
      ),
    [linkedRows, businessObject]
  );

  // annotations of each template not linked to the object yet (mesh cells
  // skipped: their parent is the one to link)
  const unlinkedIdsByKey = useMemo(() => {
    const byKey = {};
    (annotations ?? []).forEach((annotation) => {
      if (annotation.isMeshCell || relByAnnotationId[annotation.id]) return;
      const key = getQtyFormulaKey(annotation.annotationTemplateId);
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push(annotation.id);
    });
    return byKey;
  }, [annotations, relByAnnotationId]);

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

  async function handleUnlinkAll(row) {
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

      <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
        {templatesS}
      </Typography>
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
    </Box>
  );
}
