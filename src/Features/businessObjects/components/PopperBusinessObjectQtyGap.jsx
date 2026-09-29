import { useMemo } from "react";

import { Box, ClickAwayListener, Paper, Popper, Typography } from "@mui/material";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import formatBusinessObjectNumber from "../utils/formatBusinessObjectNumber";
import getBusinessObjectQtiesByTemplate from "../utils/getBusinessObjectQtiesByTemplate";
import getBusinessObjectQtyValue from "../utils/getBusinessObjectQtyValue";
import { getBusinessObjectUnitLabel } from "../utils/getBusinessObjectQtyLabel";

// Popper of the quantity gap warning of a business object row: reference
// quantity (refQty) vs quantity computed from the linked annotations, the
// gap, and the computed quantity broken down per annotation template.
// Mounted while open only.
export default function PopperBusinessObjectQtyGap({
  anchorEl,
  businessObject,
  computedQty,
  gap,
  linkedAnnotations,
  onClose,
}) {
  // strings

  const titleS = "Écart de quantité";
  const refS = "Référence";
  const computedS = "Calculée";
  const gapS = "Écart";
  const detailS = "Détail par modèle";
  const noTemplateS = "Sans modèle";

  // data

  const annotationTemplates = useAnnotationTemplates();
  const spriteImage = useAnnotationSpriteImage();

  // helpers

  const unit = businessObject.unit;
  const unitLabel = getBusinessObjectUnitLabel(unit);
  const format = (value) =>
    `${formatBusinessObjectNumber(value, 1)} ${unitLabel}`;

  const templateById = useMemo(
    () => getItemsByKey(annotationTemplates ?? [], "id"),
    [annotationTemplates]
  );
  const rows = useMemo(
    () => getBusinessObjectQtiesByTemplate(linkedAnnotations),
    [linkedAnnotations]
  );

  const sign = gap.delta > 0 ? "+" : "";
  const ratioS = Number.isFinite(gap.ratio)
    ? ` (${sign}${formatBusinessObjectNumber(
        Math.sign(gap.delta) * gap.ratio * 100,
        1
      )} %)`
    : "";
  const gapValueS = `${sign}${format(gap.delta)}${ratioS}`;

  const summary = [
    { label: refS, value: format(businessObject.refQty) },
    { label: computedS, value: format(computedQty) },
    { label: gapS, value: gapValueS, isGap: true },
  ];

  // handlers — the popper lives inside the row: clicks must not reach it

  function stop(e) {
    e.stopPropagation();
  }

  // render

  return (
    <Popper
      open
      anchorEl={anchorEl}
      placement="right-start"
      sx={{ zIndex: (theme) => theme.zIndex.modal }}
    >
      <ClickAwayListener onClickAway={onClose}>
        <Paper
          elevation={6}
          onClick={stop}
          onPointerDown={stop}
          onKeyDown={stop}
          sx={{ width: 280, p: 1.5, ml: 1, borderRadius: 2 }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {titleS}
          </Typography>
          {summary.map(({ label, value, isGap }) => (
            <Box
              key={label}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                gap: 1,
                color: isGap ? "warning.main" : "text.primary",
              }}
            >
              <Typography variant="body2" color="inherit">
                {label}
              </Typography>
              <Typography
                variant="body2"
                color="inherit"
                sx={{ fontWeight: isGap ? 600 : 400, whiteSpace: "nowrap" }}
              >
                {value}
              </Typography>
            </Box>
          ))}

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 1, mb: 0.5 }}
          >
            {detailS}
          </Typography>
          {rows.map(({ annotationTemplateId, annotationsCount, qties }) => {
            const template = templateById[annotationTemplateId];
            return (
              <Box
                key={annotationTemplateId ?? "none"}
                sx={{ display: "flex", alignItems: "center", py: 0.25 }}
              >
                <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                  <AnnotationTemplateIcon
                    template={template}
                    size={18}
                    spriteImage={spriteImage}
                  />
                </Box>
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                  {template?.label ?? noTemplateS}
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                  >
                    {` × ${annotationsCount}`}
                  </Typography>
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ ml: 1, whiteSpace: "nowrap" }}
                >
                  {format(getBusinessObjectQtyValue(unit, qties))}
                </Typography>
              </Box>
            );
          })}
        </Paper>
      </ClickAwayListener>
    </Popper>
  );
}
