import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setLinkingBusinessObjectId,
  toggleBusinessObjectCollapsed,
} from "../businessObjectsSlice";

import {
  Box,
  Chip,
  IconButton,
  ListItemButton,
  Typography,
} from "@mui/material";
import {
  MoreHoriz,
  DragIndicator,
  AddLink,
  ExpandMore,
  ChevronRight,
} from "@mui/icons-material";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import useToggleBusinessObjectSolo from "../hooks/useToggleBusinessObjectSolo";

import MenuActionsBusinessObject from "./MenuActionsBusinessObject";
import getBusinessObjectQtyLabel from "../utils/getBusinessObjectQtyLabel";

// Per-level row backgrounds. Title rows: grey band, darker at each TITLE
// nesting level. Object rows: white, then greyer at each OBJECT nesting
// level ("sous-détail"). Both capped at the 3rd level.
const TITLE_BGCOLORS = ["grey.200", "grey.300", "grey.400"];
const OBJECT_BGCOLORS = ["background.paper", "grey.50", "grey.100"];

export default function BusinessObjectTreeItem({
  businessObject,
  depth,
  hasChildren,
  listing,
  showNumbering,
  displayMeta,
  qties,
  linkedAnnotations,
  soloAnnotations,
  onAddChildBusinessObject,
}) {
  const dispatch = useDispatch();

  // data

  const selectedBusinessObjectId = useSelector(
    (s) => s.businessObjects.selectedBusinessObjectId
  );
  const linkingBusinessObjectId = useSelector(
    (s) => s.businessObjects.linkingBusinessObjectId
  );
  const collapsedIds = useSelector((s) => s.businessObjects.collapsedIds);

  const toggleBusinessObjectSolo = useToggleBusinessObjectSolo();

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);

  // dnd — the whole row is draggable (5px activation keeps clicks working),
  // with a grab handle revealed on hover, like the zones drawer rows.
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: businessObject.id,
      data: { type: "businessObject", listingId: businessObject.listingId },
    });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // helpers

  const isSelected = selectedBusinessObjectId === businessObject.id;
  const isLinking = linkingBusinessObjectId === businessObject.id;
  const collapsed = collapsedIds.includes(businessObject.id);
  const isTitle = Boolean(businessObject.isTitle);

  const linkedCount = linkedAnnotations?.length ?? 0;
  const qtyLabel =
    linkedCount > 0
      ? getBusinessObjectQtyLabel(businessObject.unit, qties)
      : null;

  const titleLevel = Math.min(
    displayMeta?.titleAncestors ?? 0,
    TITLE_BGCOLORS.length - 1
  );
  const objectLevel = Math.min(
    displayMeta?.objectAncestors ?? 0,
    OBJECT_BGCOLORS.length - 1
  );
  const rowBgcolor = isTitle
    ? TITLE_BGCOLORS[titleLevel]
    : OBJECT_BGCOLORS[objectLevel];
  const labelFontWeight = isTitle ? (titleLevel === 0 ? 700 : 600) : 400;

  // handlers

  // Clicking a row toggles its SOLO display: the editors show only the
  // annotations linked to the object or its descendants, everything else is
  // hidden. Re-click restores the full display.
  function handleClick() {
    toggleBusinessObjectSolo(businessObject, soloAnnotations);
  }

  function handleToggleCollapsed(e) {
    e.stopPropagation();
    dispatch(toggleBusinessObjectCollapsed(businessObject.id));
  }

  // Arms / disarms the picking mode on this object: annotation clicks on the
  // map then link/unlink to it (Escape exits).
  function handleLinkingClick(e) {
    e.stopPropagation();
    dispatch(setLinkingBusinessObjectId(isLinking ? null : businessObject.id));
  }

  function handleMenuClick(e) {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  }

  // render

  const chevron = hasChildren ? (
    <Box
      onClick={handleToggleCollapsed}
      sx={{
        display: "flex",
        alignItems: "center",
        mr: 0.25,
        ml: -0.75,
        color: "text.secondary",
        cursor: "pointer",
      }}
    >
      {collapsed ? (
        <ChevronRight sx={{ fontSize: 16 }} />
      ) : (
        <ExpandMore sx={{ fontSize: 16 }} />
      )}
    </Box>
  ) : null;

  const actions = (
    <Box
      className="business-object-actions"
      sx={{
        visibility: isLinking ? "visible" : "hidden",
        display: "flex",
        alignItems: "center",
      }}
    >
      <IconButton
        size="small"
        onClick={handleLinkingClick}
        title={
          isLinking
            ? "Quitter le mode liaison"
            : "Lier des annotations au clic sur la carte"
        }
        color={isLinking ? "primary" : "default"}
      >
        <AddLink sx={{ fontSize: 16 }} />
      </IconButton>
      <IconButton size="small" onClick={handleMenuClick}>
        <MoreHoriz sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );

  return (
    <>
      <ListItemButton
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        component="div"
        selected={isSelected}
        onClick={handleClick}
        sx={{
          // "Numérotation": flat 3-column rows — the number carries the
          // hierarchy, no indentation. Tree mode keeps the indentation.
          pl: showNumbering ? 1.5 : 2 + depth * 2,
          bgcolor: rowBgcolor,
          ...sortableStyle,
          "&:hover .business-object-actions": { visibility: "visible" },
          "&:hover .row-drag-handle": { opacity: 1 },
        }}
      >
        <DragIndicator
          className="row-drag-handle"
          sx={{
            fontSize: 14,
            color: "text.disabled",
            cursor: "grab",
            opacity: 0,
            transition: "0.2s",
            ml: -1.5,
            mr: 0.5,
          }}
        />
        {chevron}

        {/* col 1: hierarchical number (numbering mode only) */}
        {showNumbering && (
          <Typography
            variant="caption"
            sx={{
              fontFamily: "monospace",
              minWidth: 44,
              flexShrink: 0,
              color: isTitle ? "text.primary" : "text.secondary",
              fontWeight: labelFontWeight,
            }}
          >
            {displayMeta?.number}
          </Typography>
        )}

        {/* color chip: tree mode only, object rows only */}
        {!showNumbering && !isTitle && (
          <Box
            sx={{
              width: 12,
              height: 12,
              minWidth: 12,
              borderRadius: "2px",
              bgcolor: businessObject.color,
              mr: 1,
            }}
          />
        )}

        {/* col 2: label */}
        <Typography
          variant="body2"
          noWrap
          sx={{ flex: 1, minWidth: 0, fontWeight: labelFontWeight }}
        >
          {businessObject.label}
        </Typography>

        {/* col 3: quantity, right-aligned */}
        {qtyLabel && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ ml: 0.5, whiteSpace: "nowrap", textAlign: "right" }}
          >
            {qtyLabel}
          </Typography>
        )}
        {!showNumbering && linkedCount > 0 && (
          <Chip
            label={linkedCount}
            size="small"
            sx={{ ml: 0.5, height: 16, fontSize: "0.65rem" }}
          />
        )}
        {actions}
      </ListItemButton>

      {menuAnchor && (
        <MenuActionsBusinessObject
          anchorEl={menuAnchor}
          businessObject={businessObject}
          listing={listing}
          onAddChildBusinessObject={onAddChildBusinessObject}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </>
  );
}
