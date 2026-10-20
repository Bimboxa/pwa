import { useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setImageModeLegendOverlay } from "../mapEditorSlice";

import { Box, IconButton, Typography } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import { InputManualQty } from "Features/legend/components/SectionLegendManualQties";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getManualQtyDeviationLabel from "Features/legend/utils/getManualQtyDeviationLabel";

// Height of the small TextField: the other cells of a row center on it so the
// deviation label can grow under the qty without shifting them.
const FIELD_HEIGHT = 40;

// Legend editor of the capture tool, opened by the Edit button drawn on the
// legend (ImageModeOverlay). One row per template having an annotation on the
// displayed base map(s) — the templates hidden in the legend included, greyed
// — grouped by listing in the legend order:
//   icon | legend label (template.labelLegend, committed on blur)
//        | manual qty (imageModeLegendOverlay.hardCodedQtiesById) | unit
//        | eye (template.hiddenInLegend)
// Rows come from the Redux mirror written by ImageModeOverlay
// (imageModeLegendQtyRows), templates from the live query: the legend under
// the dialog follows every commit.
export default function DialogEditCaptureLegend({ open, onClose }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Légende";
  const emptyS = "Aucun élément de légende.";
  const labelPlaceholderS = "Libellé légende";

  // data

  const rows = useSelector((s) => s.mapEditor.imageModeLegendQtyRows);
  const overlay = useSelector((s) => s.mapEditor.imageModeLegendOverlay);
  const annotationTemplates = useAnnotationTemplates({ skip: !open });
  const spriteImage = useAnnotationSpriteImage();

  const updateAnnotationTemplate = useUpdateAnnotationTemplate();

  // helpers

  const templateById = useMemo(
    () => getItemsByKey(annotationTemplates, "id"),
    [annotationTemplates]
  );

  const hardCodedQtiesById = overlay?.hardCodedQtiesById ?? {};

  // rows grouped by listing section (legend order)
  const groups = useMemo(() => {
    const result = [];
    let current = null;
    (rows ?? []).forEach((row) => {
      const name = row.listingName ?? "";
      if (!current || current.listingName !== name) {
        current = { listingName: name, rows: [] };
        result.push(current);
      }
      current.rows.push(row);
    });
    return result;
  }, [rows]);

  // handlers

  function handleLabelLegendChange(template, labelLegend) {
    updateAnnotationTemplate({ ...template, labelLegend });
  }

  function handleToggleHiddenInLegend(template) {
    updateAnnotationTemplate({
      ...template,
      hiddenInLegend: !template.hiddenInLegend,
    });
  }

  // setImageModeLegendOverlay replaces the whole object: spread the current one
  function handleHardCodedQtyChange(templateId, value) {
    const next = { ...hardCodedQtiesById };
    if (value == null) delete next[templateId];
    else next[templateId] = value;
    dispatch(
      setImageModeLegendOverlay({ ...overlay, hardCodedQtiesById: next })
    );
  }

  // render

  return (
    <DialogGeneric
      open={open}
      onClose={onClose}
      title={titleS}
      width={560}
      // keep the editor shortcuts (V, D, Backspace…) out of the inputs
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 2, pb: 2 }}>
        {groups.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {emptyS}
          </Typography>
        )}

        {groups.map((group, groupIdx) => (
          <Box key={`${group.listingName}-${groupIdx}`} sx={{ mb: 1.5 }}>
            {Boolean(group.listingName) && (
              <Typography
                variant="body2"
                sx={{ fontWeight: "bold", mb: 0.5 }}
                noWrap
              >
                {group.listingName}
              </Typography>
            )}

            {group.rows.map((row) => {
              const template = templateById[row.id];
              if (!template) return null;
              return (
                <RowLegendTemplate
                  key={row.id}
                  row={row}
                  template={template}
                  spriteImage={spriteImage}
                  manualQty={hardCodedQtiesById[row.id]}
                  labelPlaceholder={template.label || labelPlaceholderS}
                  onLabelLegendChange={(v) =>
                    handleLabelLegendChange(template, v)
                  }
                  onToggleHiddenInLegend={() =>
                    handleToggleHiddenInLegend(template)
                  }
                  onManualQtyChange={(v) => handleHardCodedQtyChange(row.id, v)}
                />
              );
            })}
          </Box>
        ))}
      </Box>
    </DialogGeneric>
  );
}

function RowLegendTemplate({
  row,
  template,
  spriteImage,
  manualQty,
  labelPlaceholder,
  onLabelLegendChange,
  onToggleHiddenInLegend,
  onManualQtyChange,
}) {
  // helpers

  const isHidden = Boolean(template.hiddenInLegend);
  const deviationLabel = getManualQtyDeviationLabel(
    manualQty,
    row.computedValue
  );

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1,
        py: 0.25,
        opacity: isHidden ? 0.5 : 1,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: FIELD_HEIGHT,
          flexShrink: 0,
          filter: isHidden ? "grayscale(100%)" : "none",
        }}
      >
        <AnnotationTemplateIcon
          template={template}
          size={18}
          spriteImage={spriteImage}
        />
      </Box>

      {/* legend label — committed on blur (or Enter), like the template form */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <FieldTextV2
          value={template.labelLegend ?? ""}
          onChange={onLabelLegendChange}
          options={{
            fullWidth: true,
            showLabel: false,
            placeholder: labelPlaceholder,
            changeOnBlur: true,
          }}
        />
      </Box>

      {/* manual qty (placeholder = computed value) + deviation vs the
          computed value underneath once a manual value is set */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            height: FIELD_HEIGHT,
          }}
        >
          <InputManualQty
            row={row}
            value={manualQty}
            onChange={onManualQtyChange}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            title={`Calculé : ${row.computedLabel || "-"}`}
            sx={{ width: 22, flexShrink: 0 }}
          >
            {row.unit}
          </Typography>
        </Box>
        {Boolean(deviationLabel) && (
          <Typography
            variant="caption"
            color="text.secondary"
            title={`Écart par rapport à la valeur calculée (${
              row.computedLabel || "-"
            })`}
            sx={{ pr: "30px", lineHeight: 1.2 }}
          >
            {deviationLabel}
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          height: FIELD_HEIGHT,
          flexShrink: 0,
        }}
      >
        <IconButton
          size="small"
          onClick={onToggleHiddenInLegend}
          title={
            isHidden ? "Afficher dans la légende" : "Masquer de la légende"
          }
        >
          {isHidden ? (
            <VisibilityOff sx={{ fontSize: 16 }} />
          ) : (
            <Visibility sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </Box>
    </Box>
  );
}
