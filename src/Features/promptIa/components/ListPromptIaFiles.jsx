import PropTypes from "prop-types";

import { Box, Chip, IconButton, Typography } from "@mui/material";
import { Close } from "@mui/icons-material";

import formatFileSize from "../utils/formatFileSize";

// Compact list of the files joined to a « Prompt IA » zip.
// items: [{ key, label, sizeBytes, warning? }]
export default function ListPromptIaFiles({
  items = [],
  onRemove,
  disabled = false,
  maxHeight = 140,
}) {
  // strings

  const removeS = "Retirer";

  // helpers

  const totalSize = items.reduce((n, item) => n + (item.sizeBytes ?? 0), 0);
  const countS = `${items.length} fichier${items.length > 1 ? "s" : ""}${
    totalSize > 0 ? ` — ${formatFileSize(totalSize)}` : ""
  }`;

  // render

  if (items.length === 0) return null;

  return (
    <Box sx={{ width: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {countS}
      </Typography>
      <Box sx={{ maxHeight, overflowY: "auto" }}>
        {items.map((item) => (
          <Box
            key={item.key}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              minHeight: 26,
              minWidth: 0,
            }}
          >
            <Typography variant="caption" noWrap sx={{ flex: 1, minWidth: 0 }}>
              {item.label}
            </Typography>
            {Boolean(item.warning) && (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={item.warning}
              />
            )}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flexShrink: 0 }}
            >
              {formatFileSize(item.sizeBytes)}
            </Typography>
            <IconButton
              size="small"
              aria-label={`${removeS} ${item.label}`}
              onClick={() => onRemove(item.key)}
              disabled={disabled}
            >
              <Close sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

ListPromptIaFiles.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string,
      sizeBytes: PropTypes.number,
      warning: PropTypes.string,
    })
  ),
  onRemove: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  maxHeight: PropTypes.number,
};
