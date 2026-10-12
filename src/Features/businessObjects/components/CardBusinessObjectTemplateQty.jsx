import { useEffect, useState } from "react";

import {
  Box,
  Chip,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { AddLink, ChevronRight, LinkOff } from "@mui/icons-material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import formatBusinessObjectNumber from "../utils/formatBusinessObjectNumber";
import getBusinessObjectQtyValue from "../utils/getBusinessObjectQtyValue";
import { getBusinessObjectUnitLabel } from "../utils/getBusinessObjectQtyLabel";
import {
  getDefaultQtyFormula,
  normalizeQtyFormula,
  parseQtyFormula,
} from "../utils/qtyFormula";

const CHIP_SX = {
  height: 18,
  fontSize: "0.65rem",
  "& .MuiChip-label": { px: 0.75 },
};

// Card of one annotation template feeding a business object ("Quantités"
// tab): template + bulk actions (link / unlink every annotation of the
// template), the link kinds as chips — "Lien par annotation" (rels) and / or
// "Lien par modèle" (whole-template link, every annotation of the template
// in the scope) —, the annotations line (count, resulting quantity, button
// to the annotations list) and the editable quantity formula — evaluated
// per annotation with S = surface, L = length, U = unit count, then summed;
// a plain number is the quantity of the whole template.
// row: one item of getBusinessObjectQtiesByTemplate; unit: the unit the
// object's quantity is read in; unlinkedCount: annotations of the template
// not feeding the object yet (0 when linked by template).
// onUnlinkAll: removes the template link when the row is linked by template,
// else deletes the rels (two steps when both link kinds coexist).
export default function CardBusinessObjectTemplateQty({
  row,
  template,
  unit,
  unlinkedCount,
  spriteImage,
  onFormulaChange,
  onLinkAll,
  onUnlinkAll,
  onOpen,
}) {
  // strings

  const noTemplateS = "Sans modèle";
  const formulaS = "Formule";
  const helperS =
    "S = surface, L = longueur, U = unité (par annotation). Un nombre seul = quantité saisie pour le modèle.";
  const byAnnotationS = "Lien par annotation";
  const byTemplateS = "Lien par modèle";
  const isByTemplate = Boolean(row.isLinkedByTemplate);
  const hasRelLinks = (row.relLinkedCount ?? 0) > 0;
  let linkAllS = "Toutes les annotations du modèle sont liées";
  if (isByTemplate) linkAllS += " (lien par modèle)";
  else if (unlinkedCount > 0)
    linkAllS = `Lier toutes les annotations du modèle (${unlinkedCount} non liée${
      unlinkedCount > 1 ? "s" : ""
    })`;
  const unlinkAllS = isByTemplate
    ? "Retirer le lien par modèle"
    : "Délier toutes les annotations du modèle";
  const openS = "Voir les annotations liées";
  const countS = `${row.annotationsCount} annotation${
    row.annotationsCount > 1 ? "s" : ""
  }${isByTemplate ? " du modèle" : ""}`;

  // data

  const defaultFormula = getDefaultQtyFormula(unit);
  const formula = row.formula ?? defaultFormula ?? "";

  // state

  const [text, setText] = useState(formula);
  const [error, setError] = useState(null);

  useEffect(() => {
    setText(formula);
    setError(null);
  }, [formula]);

  // helpers

  const value = getBusinessObjectQtyValue(unit, row.qties);
  const valueS =
    value == null
      ? "-"
      : `${formatBusinessObjectNumber(value, 1)} ${getBusinessObjectUnitLabel(unit)}`;

  // handlers

  function handleBlur() {
    const next = text.trim();
    // emptied: back to the default formula
    if (!next) {
      setError(null);
      if (row.formula) onFormulaChange(row.annotationTemplateId, "");
      else setText(formula);
      return;
    }
    if (normalizeQtyFormula(next) === normalizeQtyFormula(formula)) {
      setError(null);
      setText(formula);
      return;
    }
    const parsed = parseQtyFormula(next);
    if (!parsed.isValid) {
      setError(parsed.error);
      return;
    }
    setError(null);
    onFormulaChange(row.annotationTemplateId, next);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") e.target.blur();
    if (e.key === "Escape") {
      setText(formula);
      setError(null);
    }
  }

  // render

  return (
    <WhiteSectionGeneric>
      {/* template + bulk actions */}
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>
          <AnnotationTemplateIcon
            template={template}
            size={20}
            spriteImage={spriteImage}
          />
        </Box>
        <Typography
          variant="body2"
          noWrap
          sx={{ flex: 1, minWidth: 0, fontWeight: "bold" }}
        >
          {template?.label ?? noTemplateS}
        </Typography>
        {/* span: a disabled button fires no event for the tooltip */}
        <Tooltip title={linkAllS} placement="top" arrow>
          <Box component="span">
            <IconButton
              size="small"
              disabled={!unlinkedCount || isByTemplate}
              onClick={() => onLinkAll(row)}
            >
              <AddLink fontSize="small" />
            </IconButton>
          </Box>
        </Tooltip>
        <Tooltip title={unlinkAllS} placement="top" arrow>
          <IconButton size="small" onClick={() => onUnlinkAll(row)}>
            <LinkOff fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* link kinds */}
      {(hasRelLinks || isByTemplate) && (
        <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
          {hasRelLinks && (
            <Chip
              size="small"
              variant="outlined"
              label={byAnnotationS}
              sx={CHIP_SX}
            />
          )}
          {isByTemplate && (
            <Chip
              size="small"
              variant="outlined"
              color="primary"
              label={byTemplateS}
              sx={CHIP_SX}
            />
          )}
        </Box>
      )}

      {/* annotations line */}
      <Box sx={{ display: "flex", alignItems: "center", mt: 0.5 }}>
        <Typography
          variant="body2"
          color="text.secondary"
          noWrap
          sx={{ flex: 1, minWidth: 0 }}
        >
          {countS}
        </Typography>
        <Typography variant="body2" sx={{ ml: 1, whiteSpace: "nowrap" }}>
          {valueS}
        </Typography>
        <Tooltip title={openS} placement="top" arrow>
          <IconButton size="small" onClick={() => onOpen(row)}>
            <ChevronRight fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* formula */}
      <TextField
        fullWidth
        size="small"
        label={formulaS}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        error={Boolean(error)}
        helperText={error ?? helperS}
        sx={{ mt: 1.5 }}
        slotProps={{
          htmlInput: {
            spellCheck: false,
            autoComplete: "off",
            sx: { fontFamily: "monospace", fontSize: 13 },
          },
        }}
      />
    </WhiteSectionGeneric>
  );
}
