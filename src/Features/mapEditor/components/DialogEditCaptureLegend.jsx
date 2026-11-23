import { useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setImageModeLegendOverlay } from "../mapEditorSlice";

import { Box, IconButton, Typography } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import FieldCheck from "Features/form/components/FieldCheck";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import { InputManualQty } from "Features/legend/components/SectionLegendManualQties";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";
import useUpdateAnnotationTemplates from "Features/annotations/hooks/useUpdateAnnotationTemplates";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getManualQtyDeviationLabel from "Features/legend/utils/getManualQtyDeviationLabel";
import { normalizeLegendGroupLabel } from "Features/legend/utils/getLegendGroupHeaders";

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
// Each listing title carries its own eye: it flags / unflags every template
// of the listing at once (one batched write). A listing whose templates are
// all hidden is drawn collapsed — greyed title, no template rows.
// Inside a listing, the rows of a template group (`groupLabel`) come under a
// group line: legend name of the group (groupLabelLegend, committed on blur,
// the group label as placeholder) | eye (groupLabelHiddenInLegend — hides the
// group TITLE of the legend, its rows stay). Both are written on every
// template of the group in the listing (one batched write).
// A switch above the rows toggles the quantities column of the legend
// (imageModeLegendOverlay.showQty, shared with the condensed toolbar and the
// "Export rapide" panel): the manual qty cells are dropped while it is off.
// Rows come from the Redux mirror written by ImageModeOverlay
// (imageModeLegendQtyRows), templates from the live query: the legend under
// the dialog follows every commit.
export default function DialogEditCaptureLegend({ open, onClose }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Légende";
  const emptyS = "Aucun élément de légende.";
  const showListingS = "Afficher la liste dans la légende";
  const hideListingS = "Masquer la liste de la légende";
  const labelPlaceholderS = "Libellé légende";
  const showGroupS = "Afficher le titre du groupe dans la légende";
  const hideGroupS = "Masquer le titre du groupe de la légende";
  const showQtyS = "Afficher les quantités";

  // data

  const rows = useSelector((s) => s.mapEditor.imageModeLegendQtyRows);
  const overlay = useSelector((s) => s.mapEditor.imageModeLegendOverlay);
  const annotationTemplates = useAnnotationTemplates({ skip: !open });
  const spriteImage = useAnnotationSpriteImage();

  const updateAnnotationTemplate = useUpdateAnnotationTemplate();
  const updateAnnotationTemplates = useUpdateAnnotationTemplates();

  // helpers

  const templateById = useMemo(
    () => getItemsByKey(annotationTemplates, "id"),
    [annotationTemplates]
  );

  const hardCodedQtiesById = overlay?.hardCodedQtiesById ?? {};
  const showQty = overlay?.showQty ?? true;

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

  // templates of a listing section + whether they are all hidden in the legend
  function getGroupTemplates(group) {
    return group.rows.map((row) => templateById[row.id]).filter(Boolean);
  }

  function getGroupIsHidden(group) {
    const templates = getGroupTemplates(group);
    return templates.length > 0 && templates.every((t) => t.hiddenInLegend);
  }

  // rows of a listing section split in runs of the same template group, in
  // the legend order: [{ key, groupLabel, templates, rows }] — key "" = rows
  // without group. `templates` = every template of the group in the listing,
  // on the plan or not.
  function getSubGroups(group) {
    const subGroups = [];
    let current = null;
    group.rows.forEach((row) => {
      const template = templateById[row.id];
      if (!template) return;
      const key = normalizeLegendGroupLabel(template.groupLabel);
      if (!current || current.key !== key) {
        current = {
          key,
          groupLabel: (template.groupLabel ?? "").trim(),
          templates: key
            ? (annotationTemplates ?? []).filter(
                (t) =>
                  t.listingId === template.listingId &&
                  normalizeLegendGroupLabel(t.groupLabel) === key
              )
            : [],
          rows: [],
        };
        subGroups.push(current);
      }
      current.rows.push({ row, template });
    });
    return subGroups;
  }

  // handlers

  // only the templates that change are written
  function handleGroupLabelLegendChange(subGroup, value) {
    const groupLabelLegend = (value ?? "").trim();
    const updates = subGroup.templates
      .filter((t) => (t.groupLabelLegend ?? "") !== groupLabelLegend)
      .map((t) => ({ id: t.id, groupLabelLegend }));
    updateAnnotationTemplates(updates);
  }

  function handleToggleGroupLabelHidden(subGroup, isHidden) {
    const groupLabelHiddenInLegend = !isHidden;
    const updates = subGroup.templates
      .filter(
        (t) => Boolean(t.groupLabelHiddenInLegend) !== groupLabelHiddenInLegend
      )
      .map((t) => ({ id: t.id, groupLabelHiddenInLegend }));
    updateAnnotationTemplates(updates);
  }

  function handleLabelLegendChange(template, labelLegend) {
    updateAnnotationTemplate({ ...template, labelLegend });
  }

  function handleToggleHiddenInLegend(template) {
    updateAnnotationTemplate({
      ...template,
      hiddenInLegend: !template.hiddenInLegend,
    });
  }

  // hide every template of the listing, or show them all back once the
  // listing is fully hidden — only the templates that change are written
  function handleToggleListingHidden(group) {
    const hiddenInLegend = !getGroupIsHidden(group);
    const updates = getGroupTemplates(group)
      .filter((t) => Boolean(t.hiddenInLegend) !== hiddenInLegend)
      .map((t) => ({ id: t.id, hiddenInLegend }));
    updateAnnotationTemplates(updates);
  }

  // setImageModeLegendOverlay replaces the whole object: spread the current one
  function handleToggleShowQty(checked) {
    dispatch(
      setImageModeLegendOverlay({ ...overlay, showQty: Boolean(checked) })
    );
  }

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
      {/* legend-wide switch, kept above the scrollable rows */}
      <Box sx={{ px: 1, pb: 1 }}>
        <FieldCheck
          value={showQty}
          onChange={handleToggleShowQty}
          label={showQtyS}
          options={{ type: "switch", showAsInline: true }}
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 2, pb: 2 }}>
        {groups.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {emptyS}
          </Typography>
        )}

        {groups.map((group, groupIdx) => {
          const groupIsHidden = getGroupIsHidden(group);
          return (
            <Box key={`${group.listingName}-${groupIdx}`} sx={{ mb: 1.5 }}>
              {Boolean(group.listingName) && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      fontWeight: "bold",
                      color: groupIsHidden ? "text.disabled" : "text.primary",
                    }}
                    noWrap
                  >
                    {group.listingName}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleToggleListingHidden(group)}
                    title={groupIsHidden ? showListingS : hideListingS}
                  >
                    {groupIsHidden ? (
                      <VisibilityOff sx={{ fontSize: 16 }} />
                    ) : (
                      <Visibility sx={{ fontSize: 16 }} />
                    )}
                  </IconButton>
                </Box>
              )}

              {(!groupIsHidden || !group.listingName) &&
                getSubGroups(group).map((subGroup, subGroupIdx) => {
                  const groupTitleIsHidden = subGroup.templates.some(
                    (t) => t.groupLabelHiddenInLegend
                  );
                  const groupLabelLegend =
                    subGroup.templates.find((t) =>
                      (t.groupLabelLegend ?? "").trim()
                    )?.groupLabelLegend ?? "";
                  return (
                    <Box key={`${subGroup.key}-${subGroupIdx}`}>
                      {Boolean(subGroup.key) && (
                        <RowLegendGroup
                          value={groupLabelLegend}
                          placeholder={subGroup.groupLabel}
                          isHidden={groupTitleIsHidden}
                          toggleTitle={
                            groupTitleIsHidden ? showGroupS : hideGroupS
                          }
                          onChange={(v) =>
                            handleGroupLabelLegendChange(subGroup, v)
                          }
                          onToggleHidden={() =>
                            handleToggleGroupLabelHidden(
                              subGroup,
                              groupTitleIsHidden
                            )
                          }
                        />
                      )}
                      {subGroup.rows.map(({ row, template }) => (
                        <RowLegendTemplate
                          key={row.id}
                          row={row}
                          template={template}
                          spriteImage={spriteImage}
                          showQty={showQty}
                          manualQty={hardCodedQtiesById[row.id]}
                          labelPlaceholder={template.label || labelPlaceholderS}
                          onLabelLegendChange={(v) =>
                            handleLabelLegendChange(template, v)
                          }
                          onToggleHiddenInLegend={() =>
                            handleToggleHiddenInLegend(template)
                          }
                          onManualQtyChange={(v) =>
                            handleHardCodedQtyChange(row.id, v)
                          }
                        />
                      ))}
                    </Box>
                  );
                })}
            </Box>
          );
        })}
      </Box>
    </DialogGeneric>
  );
}

// Group line: legend name of the group + eye of its title.
function RowLegendGroup({
  value,
  placeholder,
  isHidden,
  toggleTitle,
  onChange,
  onToggleHidden,
}) {
  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        pt: 0.75,
        pb: 0.25,
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          opacity: isHidden ? 0.5 : 1,
          "& input": {
            fontSize: (theme) => theme.typography.caption.fontSize,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            color: "text.secondary",
          },
        }}
      >
        <FieldTextV2
          value={value}
          onChange={onChange}
          options={{
            fullWidth: true,
            showLabel: false,
            placeholder,
            changeOnBlur: true,
          }}
        />
      </Box>
      <IconButton size="small" onClick={onToggleHidden} title={toggleTitle}>
        {isHidden ? (
          <VisibilityOff sx={{ fontSize: 16 }} />
        ) : (
          <Visibility sx={{ fontSize: 16 }} />
        )}
      </IconButton>
    </Box>
  );
}

function RowLegendTemplate({
  row,
  template,
  spriteImage,
  showQty,
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
          computed value underneath once a manual value is set — dropped
          with the legend's quantities column */}
      {showQty && (
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
      )}

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
