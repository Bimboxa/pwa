import { Box, ButtonBase, Tooltip } from "@mui/material";
import BorderBottom from "@mui/icons-material/BorderBottom";
import BorderLeft from "@mui/icons-material/BorderLeft";
import BorderRight from "@mui/icons-material/BorderRight";
import BorderTop from "@mui/icons-material/BorderTop";

// ---------------------------------------------------------------------------
// SelectorPrintZoneSide — the 4 small toggles of a "print zones" photo tile:
// the edge the photo snaps to (popperImages.printZonesPinnedSideById). None
// checked = automatic zone; clicking the checked one unchecks it. Used by
// the editors' tiles (TileImageAnnotation) and, inside a foreignObject, by
// the capture tiles (CaptureImagePrintZonesOverlay).
// ---------------------------------------------------------------------------

export const SELECTOR_PRINT_ZONE_SIDE_BUTTON_PX = 20;
export const SELECTOR_PRINT_ZONE_SIDE_WIDTH_PX =
  4 * SELECTOR_PRINT_ZONE_SIDE_BUTTON_PX + 4;
export const SELECTOR_PRINT_ZONE_SIDE_HEIGHT_PX =
  SELECTOR_PRINT_ZONE_SIDE_BUTTON_PX + 4;

const OPTIONS = [
  { side: "LEFT", tooltip: "Caler à gauche", Icon: BorderLeft },
  { side: "TOP", tooltip: "Caler en haut", Icon: BorderTop },
  { side: "BOTTOM", tooltip: "Caler en bas", Icon: BorderBottom },
  { side: "RIGHT", tooltip: "Caler à droite", Icon: BorderRight },
];

export default function SelectorPrintZoneSide({ value, onChange, sx }) {
  // strings

  const autoS = "(décocher : automatique)";

  // render

  return (
    <Box
      onMouseDown={(e) => e.stopPropagation()}
      sx={{
        display: "flex",
        boxSizing: "border-box",
        width: SELECTOR_PRINT_ZONE_SIDE_WIDTH_PX,
        height: SELECTOR_PRINT_ZONE_SIDE_HEIGHT_PX,
        p: "2px",
        borderRadius: "6px",
        bgcolor: "rgba(0,0,0,0.6)",
        ...sx,
      }}
    >
      {OPTIONS.map(({ side, tooltip, Icon }) => {
        const checked = side === value;
        return (
          <Tooltip
            key={side}
            title={checked ? `${tooltip} ${autoS}` : tooltip}
            arrow
            placement="top"
          >
            <ButtonBase
              onClick={(e) => {
                e.stopPropagation();
                onChange?.(checked ? null : side);
              }}
              sx={{
                width: SELECTOR_PRINT_ZONE_SIDE_BUTTON_PX,
                height: SELECTOR_PRINT_ZONE_SIDE_BUTTON_PX,
                borderRadius: "4px",
                color: checked ? "#222" : "#fff",
                bgcolor: checked ? "#fff" : "transparent",
                "&:hover": {
                  bgcolor: checked ? "#fff" : "rgba(255,255,255,0.25)",
                },
              }}
            >
              <Icon sx={{ fontSize: 16 }} />
            </ButtonBase>
          </Tooltip>
        );
      })}
    </Box>
  );
}
