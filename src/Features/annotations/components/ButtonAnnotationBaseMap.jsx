import { useSelector } from "react-redux";

import useSelectMainBaseMap from "Features/threedEditor/hooks/useSelectMainBaseMap";

import { Button, Tooltip, Typography } from "@mui/material";
import { ArrowForward as GoToIcon } from "@mui/icons-material";

// ---------------------------------------------------------------------------
// ButtonAnnotationBaseMap — base map of the selected annotation, left of the
// actions strip of ToolbarEditAnnotation (2D and 3D). The 3D scene and the 2D
// overlays display several base maps at once, so the selected annotation is
// not always on the main one:
// - main base map: its name as a plain light grey info;
// - another base map: a secondary button with a "go to" arrow — the click
//   makes it the main base map (same handler as the base maps list, the
//   annotation stays selected).
// ---------------------------------------------------------------------------

export default function ButtonAnnotationBaseMap({ annotation }) {
  // strings

  const goToS = "Aller au fond de plan";
  const currentS = "Fond de plan de l'annotation";

  // data

  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const selectMainBaseMap = useSelectMainBaseMap();

  // helpers

  const baseMapId = annotation?.baseMapId;
  // Resolved by useAnnotationsV2 from the annotation's base map.
  const name = annotation?.baseMapName;
  const isCurrent = baseMapId === mainBaseMapId;

  // handlers

  function handleClick() {
    selectMainBaseMap(baseMapId);
  }

  // render

  if (!baseMapId || !name) return null;

  if (isCurrent) {
    return (
      <Tooltip title={`${currentS} — ${name}`}>
        <Typography
          variant="caption"
          noWrap
          sx={{ color: "text.disabled", maxWidth: 160, px: 0.5 }}
        >
          {name}
        </Typography>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={`${goToS} — ${name}`}>
      <Button
        size="small"
        color="secondary"
        endIcon={<GoToIcon sx={{ fontSize: "14px !important" }} />}
        onClick={handleClick}
        sx={{
          textTransform: "none",
          minWidth: 0,
          maxWidth: 180,
          height: 24,
          px: 0.75,
          fontSize: "0.75rem",
          "& .MuiButton-endIcon": { ml: 0.5 },
        }}
      >
        <Typography variant="inherit" noWrap sx={{ minWidth: 0 }}>
          {name}
        </Typography>
      </Button>
    </Tooltip>
  );
}
