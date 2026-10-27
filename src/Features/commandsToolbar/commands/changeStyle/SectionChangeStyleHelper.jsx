import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { selectSelectedItems } from "Features/selection/selectionSlice";

import { Box, Button, Typography } from "@mui/material";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import SectionShortcutHelpers from "Features/annotations/components/SectionShortcutHelpers";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useChangeAnnotationsTemplate from "Features/annotations/hooks/useChangeAnnotationsTemplate";
import { isAnnotationLabelNodeId } from "Features/annotations/utils/annotationLabelSelection";
import { isForeignFootprintId } from "Features/annotations/constants/foreignFootprint";
import MenuPickChangeStyleTemplate from "./MenuPickChangeStyleTemplate";

import db from "App/db/db";

const SHORTCUTS = [
  { key: "⇧", label: "Ajouter / retirer de la sélection" },
  { key: "Esc", label: "Quitter" },
];

// Body of the drawing helper while « Changer de style » is armed from the
// toolbar (mapEditor.enabledDrawingMode === CHANGE_STYLE): the current
// selection grouped by template (icon + label ×n, like the header of
// ToolbarEditAnnotations) and the « Changer le style » button opening the
// template picker. Rendered by SectionDrawingHelperContent (2D docked /
// floating helper, 3D panel), so it reads redux + Dexie rather than the
// toolbar ctx; the raw DB rows are what getAnnotationTemplateChangeUpdates
// expects. The mode stays armed after a change.
export default function SectionChangeStyleHelper() {
  // strings

  const hintS = "Cliquez sur une annotation pour la sélectionner";
  const emptyS = "Aucune annotation sélectionnée";
  const changeS = "Changer le style";
  const noTemplateS = "Sans modèle";

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const annotationIds = useMemo(
    () =>
      (selectedItems ?? [])
        .filter((i) => i.type === "NODE" && i.nodeType === "ANNOTATION")
        .map((i) => i.nodeId)
        .filter(
          (id) =>
            id && !isForeignFootprintId(id) && !isAnnotationLabelNodeId(id)
        ),
    [selectedItems]
  );
  const idsKey = annotationIds.join(",");
  const annotations = useLiveQuery(async () => {
    if (!annotationIds.length) return [];
    const rows = await db.annotations.bulkGet(annotationIds);
    return rows.filter((a) => a && !a.deletedAt);
  }, [idsKey]);
  const templates = useAnnotationTemplates({ sortByLabel: true });
  const changeAnnotationsTemplate = useChangeAnnotationsTemplate();

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const templatesById = useMemo(
    () => new Map((templates ?? []).map((t) => [t.id, t])),
    [templates]
  );
  const groups = useMemo(() => {
    const byTemplate = new Map();
    (annotations ?? []).forEach((a) => {
      const key = a.annotationTemplateId ?? null;
      if (!byTemplate.has(key)) byTemplate.set(key, { key, rows: [] });
      byTemplate.get(key).rows.push(a);
    });
    return [...byTemplate.values()];
  }, [annotations]);
  const count = annotations?.length ?? 0;

  // handlers

  async function handleTemplateChange(_templateId, template) {
    try {
      await changeAnnotationsTemplate(annotations ?? [], template);
    } catch (e) {
      console.error("[changeStyle]", e);
    } finally {
      setAnchorEl(null);
    }
  }

  // render

  return (
    <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
      <Box
        sx={{
          px: 1.5,
          py: 1.5,
          borderRadius: 1,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          fontSize: "0.875rem",
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        {hintS}
      </Box>

      <Box
        sx={{
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          overflow: "hidden",
        }}
      >
        {count === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ px: 1.25, py: 1, textAlign: "center" }}
          >
            {emptyS}
          </Typography>
        ) : (
          groups.map((group) => {
            const template = templatesById.get(group.key);
            const sample = group.rows[0];
            const label =
              template?.label ??
              sample.templateLabel ??
              sample.label ??
              noTemplateS;
            const n = group.rows.length;
            return (
              <Box
                key={group.key ?? "none"}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.25,
                  py: 0.75,
                  "&:not(:last-of-type)": {
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  },
                }}
              >
                <AnnotationTemplateIcon
                  template={template ?? sample}
                  size={16}
                />
                <Typography
                  variant="body2"
                  noWrap
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    fontWeight: 600,
                    fontSize: "0.8rem",
                  }}
                >
                  {label}
                  {n > 1 && (
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ fontSize: "0.8rem", color: "text.secondary" }}
                    >
                      {` (×${n})`}
                    </Typography>
                  )}
                </Typography>
              </Box>
            );
          })
        )}

        <Box sx={{ display: "flex", justifyContent: "center", p: 1 }}>
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            disabled={count === 0}
            startIcon={<PaletteOutlinedIcon />}
            endIcon={<ArrowDropDownIcon />}
            onClick={(e) => setAnchorEl(e.currentTarget)}
          >
            {changeS}
          </Button>
        </Box>
      </Box>

      <SectionShortcutHelpers shortcuts={SHORTCUTS} />

      <MenuPickChangeStyleTemplate
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        annotations={annotations ?? []}
        onChange={handleTemplateChange}
      />
    </Box>
  );
}
