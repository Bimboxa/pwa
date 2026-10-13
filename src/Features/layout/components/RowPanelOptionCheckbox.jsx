import { Box, Checkbox, Tooltip, Typography } from "@mui/material";

// ---------------------------------------------------------------------------
// RowPanelOptionCheckbox — dense secondary option row of a panel / popper
// list: a small checkbox on the left of a muted label, the whole row
// clickable. Used for the "Visibilité auto" options of the listings and
// base maps lists.
// ---------------------------------------------------------------------------

export default function RowPanelOptionCheckbox({
  label,
  tooltip,
  checked,
  onChange,
}) {
  // handlers

  const handleClick = () => onChange?.(!checked);

  // render

  return (
    <Tooltip title={tooltip ?? ""} arrow placement="right" enterDelay={400}>
      <Box
        onClick={handleClick}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: 1,
          pr: 1.5,
          py: 0.25,
          cursor: "pointer",
          userSelect: "none",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Checkbox
          size="small"
          color="secondary"
          checked={Boolean(checked)}
          onChange={(e) => onChange?.(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          sx={{ p: 0.5, "& .MuiSvgIcon-root": { fontSize: 16 } }}
        />
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );
}
