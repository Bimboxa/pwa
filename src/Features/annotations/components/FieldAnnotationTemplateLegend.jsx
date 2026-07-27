import { Box, Typography, Switch } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import FieldTextV2 from "Features/form/components/FieldTextV2";

import SelectorAnnotationTemplateGroup from "./SelectorAnnotationTemplateGroup";

// Unified "Légende" card (design 1a): legend visibility toggle + legend label +
// a searchable group picker, grouped into a single compact section — replacing
// the former separate "Libellé légende" (with a "Masquer le titre" checkbox)
// and free-text "Groupe" sections.
//
// The toggle is shown positively as "Afficher dans la légende" (checked =
// visible); it drives the existing `hiddenInLegend` flag inverted, which
// shows/hides the whole template row in the legend. No behaviour change.
export default function FieldAnnotationTemplateLegend({
  labelLegend,
  hiddenInLegend,
  groupLabel,
  onLabelLegendChange,
  onHiddenInLegendChange,
  onGroupLabelChange,
}) {
  // handlers

  function handleVisibleChange(e) {
    onHiddenInLegendChange(!e.target.checked);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {/* section title */}
        <WhiteSectionTitle>Légende</WhiteSectionTitle>

        {/* visibility toggle */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: "bold" }} noWrap>
            Afficher dans la légende
          </Typography>
          <Switch
            size="small"
            checked={!hiddenInLegend}
            onChange={handleVisibleChange}
          />
        </Box>

        {/* legend label */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold" }} noWrap>
            Libellé
          </Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <FieldTextV2
              value={labelLegend}
              onChange={onLabelLegendChange}
              options={{ fullWidth: true, placeholder: "Libellé légende" }}
            />
          </Box>
        </Box>

        {/* group */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold" }} noWrap>
            Groupe
          </Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <SelectorAnnotationTemplateGroup
              value={groupLabel}
              onChange={onGroupLabelChange}
            />
          </Box>
        </Box>
      </Box>
    </WhiteSectionGeneric>
  );
}
