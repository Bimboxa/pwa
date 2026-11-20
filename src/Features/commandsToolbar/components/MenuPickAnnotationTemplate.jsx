import { Box, Menu } from "@mui/material";

import ListPickAnnotationTemplate from "./ListPickAnnotationTemplate";

// Gap kept between the menu and the window edge.
const WINDOW_MARGIN = 16;
// Under this height below the anchor, the menu opens above it when there is
// more room there.
const MIN_HEIGHT_BELOW = 240;

// Where the menu opens and how tall it may grow. The list is filled AFTER
// the menu was positioned (live queries), so the Popover cannot keep it in
// the window by itself: the paper is capped to the room left on the anchor's
// side and scrolls. Opened above, it is pinned by its BOTTOM edge (the
// Popover sets `top` from the still-empty menu, which would then grow down
// over the anchor).
function getPlacement(anchorEl) {
  const rect = anchorEl?.getBoundingClientRect?.();
  if (!rect) return { above: false, maxHeight: undefined };
  const below = window.innerHeight - rect.bottom - WINDOW_MARGIN;
  const above = rect.top - WINDOW_MARGIN;
  const openAbove = below < MIN_HEIGHT_BELOW && above > below;
  return {
    above: openAbove,
    maxHeight: Math.max(120, openAbove ? above : below),
    bottom: window.innerHeight - rect.top,
  };
}

// Menu wrapping ListPickAnnotationTemplate (the list, hence its queries, only
// exists while the menu is open). `children` go above the list (options);
// `getItemSuffix(template)` is the optional right-hand text of a row;
// `panelOrder` lists the templates in the order of the annotations panel.
// Scrollable: never taller than the room between its anchor and the window
// edge (getPlacement).
// `selectedAnnotationTemplateIds` (array) turns the rows into checkboxes: the
// caller toggles the ids in `onChange` and keeps the menu open; `footer` is
// pinned at the bottom of the menu (validation button).
export default function MenuPickAnnotationTemplate({
  open,
  anchorEl,
  onClose,
  filterTemplate,
  onChange,
  selectedAnnotationTemplateId = null,
  selectedAnnotationTemplateIds = null,
  emptyText,
  getItemSuffix,
  minWidth = 240,
  panelOrder = false,
  footer = null,
  children,
}) {
  // helpers

  const isOpen = Boolean(open && anchorEl);
  const { above, maxHeight, bottom } = isOpen ? getPlacement(anchorEl) : {};

  // render

  return (
    <Menu
      open={isOpen}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: above ? "top" : "bottom", horizontal: "left" }}
      transformOrigin={{
        vertical: above ? "bottom" : "top",
        horizontal: "left",
      }}
      slotProps={{
        paper: {
          sx: {
            minWidth,
            maxHeight,
            overflowY: "auto",
            ...(above && { top: "auto !important", bottom }),
          },
        },
      }}
    >
      {children}
      {open && (
        <ListPickAnnotationTemplate
          filterTemplate={filterTemplate}
          onChange={onChange}
          selectedAnnotationTemplateId={selectedAnnotationTemplateId}
          selectedAnnotationTemplateIds={selectedAnnotationTemplateIds}
          emptyText={emptyText}
          getItemSuffix={getItemSuffix}
          panelOrder={panelOrder}
        />
      )}
      {footer && (
        <Box
          sx={{
            position: "sticky",
            bottom: 0,
            zIndex: 1,
            // the menu list has its own bottom padding: cover it
            mb: -1,
            bgcolor: "background.paper",
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          {footer}
        </Box>
      )}
    </Menu>
  );
}
