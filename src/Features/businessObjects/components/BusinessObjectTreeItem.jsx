import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setActiveBusinessObjectId,
  setLinkingBusinessObjectId,
  toggleBusinessObjectCollapsed,
} from "../businessObjectsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import {
  Box,
  Chip,
  IconButton,
  ListItemButton,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  MoreHoriz,
  DragIndicator,
  AddLink,
  ExpandMore,
  ChevronRight,
  FilterAlt,
  FilterAltOutlined,
  Place,
} from "@mui/icons-material";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import useToggleBusinessObjectSolo from "../hooks/useToggleBusinessObjectSolo";

import MenuActionsBusinessObject from "./MenuActionsBusinessObject";
import selectSelectedBusinessObjectId from "../utils/selectSelectedBusinessObjectId";
import getBusinessObjectQtyLabel from "../utils/getBusinessObjectQtyLabel";
import getHoursRatioUnit from "../utils/getHoursRatioUnit";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import { formatHours, formatHoursRatio } from "../utils/hoursRatioConversions";

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
  mainRels,
  mainAnnotations,
  // rolled-up hours (own + descendants) — PLANNING listings only
  hoursBudget,
  // {total, planned, done, plannedRatio, doneRatio} over the work packages
  // (useTaskPlanningProgress) — PLANNING listings only
  planningProgress,
  onAddChildBusinessObject,
}) {
  const dispatch = useDispatch();

  // data

  const selectedBusinessObjectId = useSelector(selectSelectedBusinessObjectId);
  const soloBusinessObjectId = useSelector(
    (s) => s.businessObjects.soloBusinessObjectId
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
  const isSolo = soloBusinessObjectId === businessObject.id;
  const isLinking = linkingBusinessObjectId === businessObject.id;
  const collapsed = collapsedIds.includes(businessObject.id);
  const isTitle = Boolean(businessObject.isTitle);

  const linkedCount = linkedAnnotations?.length ?? 0;
  // "located" object: main annotation(s), one per base map
  const locatedBaseMapsCount = new Set(
    (mainRels ?? []).map((r) => r.baseMapId ?? "")
  ).size;
  const locatedS =
    locatedBaseMapsCount > 0
      ? `Localisé sur ${locatedBaseMapsCount} plan${
          locatedBaseMapsCount > 1 ? "s" : ""
        }`
      : null;
  // Tasks (hoursBudget feature): the right column shows the rolled-up hours,
  // the ratio and the quantity move to a caption line under the label. A task
  // reads its quantity in its RATIO unit — it has no quantity unit of its own.
  // The color chip only shows for the types carrying a color.
  const type = getBusinessObjectTypeOfListing(listing);
  const hasHoursBudget = Boolean(type.features?.hoursBudget);
  const hasColor = Boolean(type.features?.color);
  const qtyLabel =
    linkedCount > 0
      ? getBusinessObjectQtyLabel(
          hasHoursBudget
            ? getHoursRatioUnit(businessObject)
            : businessObject.unit,
          qties
        )
      : null;
  const ratioLabel = hasHoursBudget ? formatHoursRatio(businessObject) : null;
  const hoursLabel =
    hasHoursBudget && hoursBudget > 0
      ? formatHours(hoursBudget, { withDays: false })
      : null;
  const pct = (r) => `${Math.round(r * 100)} %`;
  const plannedLabel =
    planningProgress?.plannedRatio != null
      ? `planifié ${pct(planningProgress.plannedRatio)}`
      : null;
  const doneLabel =
    planningProgress?.doneRatio != null
      ? `fait ${pct(planningProgress.doneRatio)}`
      : null;
  const captionLabel = hasHoursBudget
    ? [ratioLabel, qtyLabel, plannedLabel, doneLabel]
        .filter(Boolean)
        .join(" · ")
    : "";
  const rightLabel = hasHoursBudget ? hoursLabel : qtyLabel;

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

  // Clicking a row SELECTS the object: its properties open in the right panel
  // and it becomes the module's ACTIVE object (popper "Localisation" mode,
  // LOCATE_BUSINESS_OBJECT target). The SOLO display is toggled exclusively by
  // the filter icon button (zones drawer pattern).
  function handleClick() {
    dispatch(setActiveBusinessObjectId(businessObject.id));
    dispatch(
      setSelectedItem({
        id: businessObject.id,
        type: "BUSINESS_OBJECT",
        listingId: businessObject.listingId,
      })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  function handleSoloClick(e) {
    e.stopPropagation();
    toggleBusinessObjectSolo(businessObject, soloAnnotations, mainAnnotations);
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
        visibility: isLinking || isSolo ? "visible" : "hidden",
        display: "flex",
        alignItems: "center",
      }}
    >
      <IconButton
        size="small"
        onClick={handleSoloClick}
        title={
          isSolo
            ? "Tout afficher"
            : `Afficher uniquement « ${businessObject.label} »`
        }
        color={isSolo ? "primary" : "default"}
      >
        {isSolo ? (
          <FilterAlt sx={{ fontSize: 16 }} />
        ) : (
          <FilterAltOutlined sx={{ fontSize: 16 }} />
        )}
      </IconButton>
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

        {/* color chip: colored types, tree mode only, object rows only */}
        {hasColor && !showNumbering && !isTitle && (
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

        {/* col 2: label (+ ratio · quantity caption for tasks) */}
        {captionLabel ? (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              noWrap
              sx={{ fontWeight: labelFontWeight }}
            >
              {businessObject.label}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: "block", lineHeight: 1.2 }}
            >
              {captionLabel}
            </Typography>
          </Box>
        ) : (
          <Typography
            variant="body2"
            noWrap
            sx={{ flex: 1, minWidth: 0, fontWeight: labelFontWeight }}
          >
            {businessObject.label}
          </Typography>
        )}

        {/* located indicator: main annotation(s) on the plans */}
        {locatedS && (
          <Tooltip title={locatedS}>
            <Place sx={{ fontSize: 14, color: "primary.main", ml: 0.5 }} />
          </Tooltip>
        )}

        {/* col 3: quantity (tasks: rolled-up hours), right-aligned */}
        {rightLabel && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ ml: 0.5, whiteSpace: "nowrap", textAlign: "right" }}
          >
            {rightLabel}
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
