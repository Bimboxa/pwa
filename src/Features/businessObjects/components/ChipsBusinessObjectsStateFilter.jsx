import { Box, Chip } from "@mui/material";

// State filter band of the business-objects tree (Krnet EntityListScreen
// chips): "Tous N" then one chip per state — the open / closed status of the
// ISSUE type, the states of the listing's primary Krnet state model (colored
// dot). Single active chip, filled; the counts are computed by the caller
// over the current level's descendants.
// options: [{value, label, count, color?}]
export default function ChipsBusinessObjectsStateFilter({
  options,
  value,
  onChange,
}) {
  // render

  return (
    <Box
      sx={{
        display: "flex",
        gap: 0.5,
        px: 1,
        py: 0.75,
        overflowX: "auto",
        borderBottom: "1px solid",
        borderColor: "divider",
        // horizontal strip: the chips never wrap, the band scrolls instead
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {(options ?? []).map((opt) => {
        const active = opt.value === value;
        return (
          <Chip
            key={opt.value}
            size="small"
            color={active ? "primary" : "default"}
            variant={active ? "filled" : "outlined"}
            onClick={() => onChange(opt.value)}
            icon={
              opt.color ? (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: opt.color,
                    ml: "6px !important",
                    flexShrink: 0,
                  }}
                />
              ) : undefined
            }
            label={
              <Box component="span" sx={{ display: "inline-flex", gap: 0.5 }}>
                <Box component="span" sx={{ fontWeight: 600 }}>
                  {opt.label}
                </Box>
                <Box component="span" sx={{ opacity: 0.7 }}>
                  {opt.count}
                </Box>
              </Box>
            }
            sx={{ flexShrink: 0 }}
          />
        );
      })}
    </Box>
  );
}
