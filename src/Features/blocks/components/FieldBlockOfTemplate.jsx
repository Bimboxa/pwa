import { Box, MenuItem, Select, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import useBlocks from "../hooks/useBlocks";

// Field of a BLOCK annotation template: the block it points to
// (`template.blockId`) — a new block created with the template (default), or
// one of the blocks of the scope.
export default function FieldBlockOfTemplate({ value, onChange }) {
  // strings

  const labelS = "Bloc";
  const newS = "Nouveau bloc";
  const captionNewS =
    "Un bloc portant le libellé du modèle sera créé. Dessinez ensuite ses annotations sur son fond de plan de blocs.";

  // data

  const blocks = useBlocks();

  // helpers

  const selectedId = (blocks ?? []).some((b) => b.id === value) ? value : "";

  // handlers

  function handleChange(e) {
    const blockId = e.target.value || null;
    onChange(blockId, (blocks ?? []).find((b) => b.id === blockId) ?? null);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          {labelS}
        </Typography>
        <Select
          size="small"
          displayEmpty
          value={selectedId}
          onChange={handleChange}
          sx={{ minWidth: 160, fontSize: 13 }}
          renderValue={(id) =>
            (blocks ?? []).find((b) => b.id === id)?.label ?? newS
          }
        >
          <MenuItem value="" dense>
            {newS}
          </MenuItem>
          {(blocks ?? []).map((b) => (
            <MenuItem key={b.id} value={b.id} dense>
              {b.label}
            </MenuItem>
          ))}
        </Select>
      </Box>
      {!selectedId && (
        <Typography variant="caption" color="text.secondary">
          {captionNewS}
        </Typography>
      )}
    </WhiteSectionGeneric>
  );
}
