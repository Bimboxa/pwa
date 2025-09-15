import { Box, IconButton } from "@mui/material";

export default function SelectorIconGeneric({
  iconKey,
  onChange,
  iconsMap,
  iconColor,
}) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap" }}>
      {Array.from(iconsMap.entries()).map(([key, IconComponent]) => {
        const selected = key === iconKey;
        return (
          <Box
            key={key}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
              bgcolor: selected ? iconColor : "white",
              color: selected ? "white" : "text.secondary",
              mr: 1,
              mb: 1,
            }}
          >
            <IconButton
              selected={selected}
              onClick={() => onChange(key)}
              color="inherit"
            >
              <IconComponent />
            </IconButton>
          </Box>
        );
      })}
    </Box>
  );
}
