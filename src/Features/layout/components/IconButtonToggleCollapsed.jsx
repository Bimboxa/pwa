import { IconButton, Tooltip } from "@mui/material";
import UnfoldLess from "@mui/icons-material/UnfoldLess";
import UnfoldMore from "@mui/icons-material/UnfoldMore";

// ---------------------------------------------------------------------------
// IconButtonToggleCollapsed — collapse / expand ("Replier" / "Déplier") icon
// button of a floating panel, at the far right of its header
// (PopperMapListings, PopperBaseMapsList): collapsed, the panel is its
// header alone. An icon button in both states.
// ---------------------------------------------------------------------------

export default function IconButtonToggleCollapsed({
  collapsed = false,
  onToggle,
  tooltipPlacement = "top",
}) {
  // strings

  const collapseS = "Replier";
  const expandS = "Déplier";

  // helpers

  const Icon = collapsed ? UnfoldMore : UnfoldLess;

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    onToggle?.();
  }

  // render

  return (
    <Tooltip
      title={collapsed ? expandS : collapseS}
      arrow
      placement={tooltipPlacement}
    >
      <IconButton
        size="small"
        // The header is the drag handle of the panel.
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleClick}
        sx={{
          color: "panel.textLight",
          p: 0.25,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <Icon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  );
}
