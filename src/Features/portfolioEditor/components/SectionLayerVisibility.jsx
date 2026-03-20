import { Box, Typography, IconButton } from "@mui/material";
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from "@mui/icons-material";

const ICON_SIZE = 18;
const NO_LAYER_ID = "__no_layer__";

export default function SectionLayerVisibility({
  layers,
  disabledLayerIds,
  annotationCountByLayerId,
  hasAnnotationsWithoutLayer,
  onToggleLayer,
}) {
  // helpers

  const allLayerIds = [
    ...(hasAnnotationsWithoutLayer ? [NO_LAYER_ID] : []),
    ...layers.map((l) => l.id),
  ];

  const allDisabled =
    allLayerIds.length > 0 &&
    allLayerIds.every((id) => disabledLayerIds.includes(id));

  // handlers

  function handleToggleAll() {
    if (allDisabled) {
      allLayerIds.forEach((id) => {
        if (disabledLayerIds.includes(id)) onToggleLayer(id);
      });
    } else {
      allLayerIds.forEach((id) => {
        if (!disabledLayerIds.includes(id)) onToggleLayer(id);
      });
    }
  }

  // render

  if (allLayerIds.length === 0) return null;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Typography variant="caption" sx={{ fontWeight: "bold", flex: 1 }}>
          Calques
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
        {hasAnnotationsWithoutLayer && (
          <LayerRow
            label="Sans calque"
            count={annotationCountByLayerId[NO_LAYER_ID] ?? 0}
            isDisabled={disabledLayerIds.includes(NO_LAYER_ID)}
            onToggle={() => onToggleLayer(NO_LAYER_ID)}
          />
        )}
        {layers.map((layer) => (
          <LayerRow
            key={layer.id}
            label={layer.name}
            count={annotationCountByLayerId[layer.id] ?? 0}
            isDisabled={disabledLayerIds.includes(layer.id)}
            onToggle={() => onToggleLayer(layer.id)}
          />
        ))}
      </Box>
    </Box>
  );
}

function LayerRow({ label, count, isDisabled, onToggle }) {
  return (
    <Box
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
        {label}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mx: 0.5, flexShrink: 0 }}
      >
        {count}
      </Typography>
      <IconButton
        size="small"
        onClick={onToggle}
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
}
