import { Box, Typography, IconButton } from "@mui/material";
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from "@mui/icons-material";

const ICON_SIZE = 18;

export default function SectionDuplicateBaseMaps({
  baseMaps,
  countByBaseMapId,
  disabledBaseMapIds,
  onToggleBaseMap,
}) {
  // helpers

  const allIds = baseMaps.map((b) => b.id);
  const allDisabled =
    allIds.length > 0 && allIds.every((id) => disabledBaseMapIds.includes(id));

  // handlers

  function handleToggleAll() {
    allIds.forEach((id) => {
      const isDisabled = disabledBaseMapIds.includes(id);
      if (allDisabled ? isDisabled : !isDisabled) onToggleBaseMap(id);
    });
  }

  // render

  if (allIds.length === 0) return null;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Typography variant="caption" sx={{ fontWeight: "bold", flex: 1 }}>
          Fonds de plan
        </Typography>
        <IconButton
          size="small"
          onClick={handleToggleAll}
          sx={{ width: 28, height: 28 }}
        >
          {allDisabled ? (
            <VisibilityOffIcon sx={{ fontSize: ICON_SIZE }} />
          ) : (
            <VisibilityIcon sx={{ fontSize: ICON_SIZE }} />
          )}
        </IconButton>
      </Box>

      <Box
        sx={{
          mt: 0.5,
          borderRadius: "4px",
          border: (theme) => `1px solid ${theme.palette.divider}`,
          overflow: "hidden",
        }}
      >
        {baseMaps.map((baseMap) => {
          const isDisabled = disabledBaseMapIds.includes(baseMap.id);
          return (
            <Box
              key={baseMap.id}
              sx={{
                display: "flex",
                alignItems: "center",
                px: 1,
                py: 0.25,
                opacity: isDisabled ? 0.4 : 1,
              }}
            >
              <Typography
                variant="caption"
                noWrap
                sx={{ flex: 1, minWidth: 0 }}
              >
                {baseMap.name || "Sans nom"}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mx: 0.5, flexShrink: 0 }}
              >
                {countByBaseMapId[baseMap.id] ?? 0}
              </Typography>
              <IconButton
                size="small"
                onClick={() => onToggleBaseMap(baseMap.id)}
                sx={{ width: 28, height: 28, flexShrink: 0 }}
              >
                {isDisabled ? (
                  <VisibilityOffIcon sx={{ fontSize: ICON_SIZE }} />
                ) : (
                  <VisibilityIcon sx={{ fontSize: ICON_SIZE }} />
                )}
              </IconButton>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
