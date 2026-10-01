import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setActiveBusinessObjectId,
  setLinkingBusinessObjectId,
  toggleBusinessObjectCollapsed,
} from "../businessObjectsSlice";
import {
  clearSelection,
  setSelectedItem,
} from "Features/selection/selectionSlice";

import {
  Avatar,
  Box,
  Checkbox,
  Chip,
  IconButton,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  MoreHoriz,
  DragIndicator,
  AddLink,
  DescriptionOutlined,
  ExpandMore,
  ChevronRight,
  FilterAlt,
  FilterAltOutlined,
  Place,
  WarningAmber,
} from "@mui/icons-material";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import useToggleBusinessObjectSolo from "../hooks/useToggleBusinessObjectSolo";
import useUpdateBusinessObject from "../hooks/useUpdateBusinessObject";
import useOpenBusinessObjectDocumentLink from "../hooks/useOpenBusinessObjectDocumentLink";

import MenuActionsBusinessObject from "./MenuActionsBusinessObject";
import PopperBusinessObjectQtyGap from "./PopperBusinessObjectQtyGap";
import selectSelectedBusinessObjectId from "../utils/selectSelectedBusinessObjectId";
import getBusinessObjectQtyLabel from "../utils/getBusinessObjectQtyLabel";
import getBusinessObjectQtyValue from "../utils/getBusinessObjectQtyValue";
import getBusinessObjectQtyGap from "../utils/getBusinessObjectQtyGap";
import { getBusinessObjectUnitText } from "../utils/getBusinessObjectQtyKind";
import formatBusinessObjectNumber from "../utils/formatBusinessObjectNumber";
import getHoursRatioUnit from "../utils/getHoursRatioUnit";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import {
  BUSINESS_OBJECT_STATUS,
  isBusinessObjectClosed,
} from "../utils/getBusinessObjectStatus";
import isWholeResourceRel from "../utils/isWholeResourceRel";
import { formatHours, formatHoursRatio } from "../utils/hoursRatioConversions";

// Per-level row backgrounds. Title rows: grey band, darker at each TITLE
// nesting level. Object rows: white, then greyer at each OBJECT nesting
// level ("sous-détail"). Both capped at the 3rd level.
const TITLE_BGCOLORS = ["grey.200", "grey.300", "grey.400"];
const OBJECT_BGCOLORS = ["background.paper", "grey.50", "grey.100"];

// Rows are top-aligned (labels wrap on several lines): the side items are
// centered on the FIRST line of the label.
const FIRST_LINE_HEIGHT = 20;
const firstLineSx = {
  display: "flex",
  alignItems: "center",
  minHeight: FIRST_LINE_HEIGHT,
  flexShrink: 0,
};

export default function BusinessObjectTreeItem({
  businessObject,
  depth,
  hasChildren,
  listing,
  // Viewer module: display, solo, linked documents and selection only
  readOnly = false,
  // the listing has codes: flat 3-column rows (code / label / quantity)
  showCodes,
  // {primary, secondary, initial, color, avatarUrl} | null — Krnet
  // "Aperçu de l'objet" rendering (listing setting listCard), object rows
  // only: avatar + two texts replace the color square + label
  card,
  displayMeta,
  qties,
  linkedAnnotations,
  soloAnnotations,
  mainRels,
  mainAnnotations,
  // links to resources (highlighted zones of PDF documents or whole
  // resources), in reading order
  documentRels,
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
  const activeBusinessObjectId = useSelector(
    (s) => s.businessObjects.activeBusinessObjectId
  );
  const soloBusinessObjectId = useSelector(
    (s) => s.businessObjects.soloBusinessObjectId
  );
  const linkingBusinessObjectId = useSelector(
    (s) => s.businessObjects.linkingBusinessObjectId
  );
  const collapsedIds = useSelector((s) => s.businessObjects.collapsedIds);

  const toggleBusinessObjectSolo = useToggleBusinessObjectSolo();
  const openDocumentLink = useOpenBusinessObjectDocumentLink();
  const updateBusinessObject = useUpdateBusinessObject();

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [gapAnchor, setGapAnchor] = useState(null);
  const [documentsAnchor, setDocumentsAnchor] = useState(null);

  // dnd — the whole row is draggable (5px activation keeps clicks working),
  // with a grab handle revealed on hover, like the zones drawer rows.
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: businessObject.id,
      data: { type: "businessObject", listingId: businessObject.listingId },
      disabled: readOnly,
    });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // helpers

  const isSelected = selectedBusinessObjectId === businessObject.id;
  const isActive = activeBusinessObjectId === businessObject.id;
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
  const hasQuantities = Boolean(type.features?.quantities);
  // open / closed points (type feature status): checkbox + struck label
  const hasStatus = Boolean(type.features?.status);
  const isClosed = hasStatus && isBusinessObjectClosed(businessObject);
  const closedLabelSx = isClosed
    ? { textDecoration: "line-through", color: "text.disabled" }
    : {};
  const statusS = isClosed ? "Rouvrir" : "Fermer";

  // Action buttons (bottom right of the row): the solo button only shows when
  // there are annotations to isolate (own + descendants') — or to leave the
  // solo —, the documents button when the object links to a resource.
  const showSolo =
    isSolo || soloAnnotations?.length > 0 || mainAnnotations?.length > 0;
  const showDocuments = documentRels?.length > 0;
  const hasActions = showSolo || showDocuments || !readOnly;
  const soloS = isSolo
    ? "Tout afficher"
    : `Afficher uniquement « ${businessObject.label} »`;
  const documentsS = !showDocuments
    ? ""
    : documentRels.every(isWholeResourceRel)
      ? documentRels.length === 1
        ? "Voir le document lié"
        : `Voir les ${documentRels.length} documents liés`
      : documentRels.length === 1
        ? "Voir le passage lié dans le document"
        : `Voir les ${documentRels.length} passages liés dans les documents`;
  const linkingS = isLinking
    ? "Quitter le mode liaison"
    : "Lier des annotations au clic sur la carte";
  const menuS = "Plus d'actions";
  const qtyLabel =
    hasQuantities && linkedCount > 0
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
  // Articles: quantity computed from the linked annotations, else the
  // reference quantity (refQty, greyed), else the bare unit (greyed). A
  // unit-less row (a title, typically) shows nothing.
  const unitText = getBusinessObjectUnitText(businessObject.unit);
  const hasRefQty = Number.isFinite(businessObject.refQty);
  const articleQtyLabel =
    qtyLabel ??
    (hasQuantities && unitText
      ? `${
          hasRefQty ? formatBusinessObjectNumber(businessObject.refQty, 1) : "–"
        } ${unitText}`
      : null);
  const rightLabel = hasHoursBudget ? hoursLabel : articleQtyLabel;
  const rightLabelMuted = !hasHoursBudget && !qtyLabel;
  // gap between the computed quantity and the reference one (> 5 %)
  const computedQty =
    hasQuantities && !hasHoursBudget && linkedCount > 0
      ? getBusinessObjectQtyValue(businessObject.unit, qties)
      : null;
  const qtyGap = getBusinessObjectQtyGap(computedQty, businessObject.refQty);
  const showQtyGap = Boolean(qtyGap?.isOver);
  // card rows: the configured texts; the tasks caption follows the
  // secondary text on the same line
  const primaryLabel = card?.primary || businessObject.label;
  const secondaryLine = [card?.secondary, captionLabel]
    .filter(Boolean)
    .join(" · ");

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

  // Clicking a row makes the object the module's ACTIVE object (popper titled
  // with its name, drawn annotations link to it — LOCATE / LINK interceptor
  // targets) and selects it (its properties show in the right panel when that
  // panel is open — the click does NOT open it). Clicking the active object
  // again deactivates it: the popper falls back to its edit-only mode and the
  // module's default LISTING selection re-poses. The SOLO display is toggled
  // exclusively by the filter icon button (zones drawer pattern).
  // Read-only rows only toggle the selection: the active object drives the
  // drawing popper and the LOCATE / LINK interceptors of the module.
  function handleClick() {
    if (readOnly) {
      if (isSelected) {
        dispatch(clearSelection());
        return;
      }
      dispatch(
        setSelectedItem({
          id: businessObject.id,
          type: "BUSINESS_OBJECT",
          listingId: businessObject.listingId,
        })
      );
      return;
    }
    if (isActive) {
      dispatch(setActiveBusinessObjectId(null));
      dispatch(clearSelection());
      return;
    }
    dispatch(setActiveBusinessObjectId(businessObject.id));
    dispatch(
      setSelectedItem({
        id: businessObject.id,
        type: "BUSINESS_OBJECT",
        listingId: businessObject.listingId,
      })
    );
  }

  function handleStatusChange(e) {
    updateBusinessObject(businessObject.id, {
      status: e.target.checked
        ? BUSINESS_OBJECT_STATUS.CLOSED
        : BUSINESS_OBJECT_STATUS.OPEN,
    });
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

  // Opens the linked document at the highlighted zone; several links: the
  // menu lists them.
  function handleDocumentsClick(e) {
    e.stopPropagation();
    if (!documentRels?.length) return;
    if (documentRels.length === 1) {
      openDocumentLink(businessObject, documentRels[0]);
      return;
    }
    setDocumentsAnchor(e.currentTarget);
  }

  function handleDocumentRelClick(rel) {
    setDocumentsAnchor(null);
    openDocumentLink(businessObject, rel);
  }

  function handleGapClick(e) {
    e.stopPropagation();
    setGapAnchor(gapAnchor ? null : e.currentTarget);
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
        ...firstLineSx,
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

  const actions = hasActions ? (
    <Box
      sx={{
        // own line under the row content, flush bottom right: always
        // visible, never over the label or the quantity column
        flexBasis: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        mr: -0.5,
        mb: -0.5,
      }}
    >
      {showSolo && (
        <Tooltip title={soloS}>
          <IconButton
            size="small"
            onClick={handleSoloClick}
            color={isSolo ? "primary" : "default"}
          >
            {isSolo ? (
              <FilterAlt sx={{ fontSize: 16 }} />
            ) : (
              <FilterAltOutlined sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
      )}
      {showDocuments && (
        <Tooltip title={documentsS}>
          <IconButton size="small" onClick={handleDocumentsClick}>
            <DescriptionOutlined sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}
      {!readOnly && (
        <Tooltip title={linkingS}>
          <IconButton
            size="small"
            onClick={handleLinkingClick}
            color={isLinking ? "primary" : "default"}
          >
            <AddLink sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}
      {!readOnly && (
        <Tooltip title={menuS}>
          <IconButton size="small" onClick={handleMenuClick}>
            <MoreHoriz sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  ) : null;

  return (
    <>
      <ListItemButton
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        component="div"
        divider
        selected={isSelected || (!readOnly && isActive)}
        onClick={handleClick}
        sx={{
          // Listing with codes: flat 3-column rows — the code carries the
          // hierarchy, no indentation. Tree mode keeps the indentation.
          pl: showCodes ? 1.5 : 2 + depth * 2,
          pr: 1.5,
          alignItems: "flex-start",
          // the actions line (100% wide) wraps under the row content
          flexWrap: "wrap",
          bgcolor: rowBgcolor,
          ...sortableStyle,
          "&:hover .row-drag-handle": { opacity: 1 },
        }}
      >
        {!readOnly && (
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
              mt: "3px",
              flexShrink: 0,
            }}
          />
        )}
        {chevron}

        {/* col 1: code (listings with codes only) */}
        {showCodes && (
          <Typography
            variant="caption"
            sx={{
              fontFamily: "monospace",
              minWidth: 44,
              mr: 1,
              flexShrink: 0,
              lineHeight: `${FIRST_LINE_HEIGHT}px`,
              color: isTitle ? "text.primary" : "text.secondary",
              fontWeight: labelFontWeight,
            }}
          >
            {businessObject.code}
          </Typography>
        )}

        {/* card avatar: photo thumbnail, else initial on a colored disc */}
        {card && (
          <Avatar
            src={card.avatarUrl ?? undefined}
            sx={{
              width: 28,
              height: 28,
              mr: 1,
              fontSize: 13,
              fontWeight: 700,
              bgcolor: card.color,
              color: "common.white",
              flexShrink: 0,
            }}
          >
            {card.initial}
          </Avatar>
        )}

        {/* color chip: colored types, tree mode only, object rows only */}
        {hasColor && !showCodes && !isTitle && !card && (
          <Box
            sx={{
              width: 12,
              height: 12,
              minWidth: 12,
              borderRadius: "2px",
              bgcolor: businessObject.color,
              mr: 1,
              mt: "4px",
            }}
          />
        )}

        {/* status checkbox: types with a status, object rows only. Stops the
            pointer events: neither the row click nor the dnd must fire. */}
        {hasStatus && !isTitle && (
          <Checkbox
            size="small"
            checked={isClosed}
            disabled={readOnly}
            onChange={handleStatusChange}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            title={statusS}
            sx={{ p: 0, mr: 0.75, height: FIRST_LINE_HEIGHT }}
          />
        )}

        {/* col 2: label (+ secondary text / ratio · quantity caption) */}
        {secondaryLine ? (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: labelFontWeight,
                overflowWrap: "anywhere",
                ...closedLabelSx,
              }}
            >
              {primaryLabel}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                lineHeight: 1.2,
                overflowWrap: "anywhere",
              }}
            >
              {secondaryLine}
            </Typography>
          </Box>
        ) : (
          <Typography
            variant="body2"
            sx={{
              flex: 1,
              minWidth: 0,
              fontWeight: labelFontWeight,
              overflowWrap: "anywhere",
              ...closedLabelSx,
            }}
          >
            {primaryLabel}
          </Typography>
        )}

        {/* located indicator: main annotation(s) on the plans */}
        {locatedS && (
          <Tooltip title={locatedS}>
            <Place
              sx={{
                fontSize: 14,
                color: "primary.main",
                ml: 0.5,
                mt: "3px",
                flexShrink: 0,
              }}
            />
          </Tooltip>
        )}

        {!showCodes && linkedCount > 0 && (
          <Box sx={{ ...firstLineSx, ml: 0.5 }}>
            <Chip
              label={linkedCount}
              size="small"
              sx={{ height: 16, fontSize: "0.65rem" }}
            />
          </Box>
        )}

        {/* quantity gap warning: computed vs reference quantity */}
        {showQtyGap && (
          <Box sx={{ ...firstLineSx, ml: 0.5 }}>
            <IconButton
              size="small"
              onClick={handleGapClick}
              onPointerDown={(e) => e.stopPropagation()}
              title="Écart avec la quantité de référence"
              sx={{ p: 0.25, color: "warning.main" }}
            >
              <WarningAmber sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        )}

        {/* col 3: quantity + unit (tasks: rolled-up hours), flush right —
            greyed when it is not computed from linked annotations */}
        {rightLabel && (
          <Typography
            variant="caption"
            sx={{
              ml: 1,
              flexShrink: 0,
              whiteSpace: "nowrap",
              textAlign: "right",
              lineHeight: `${FIRST_LINE_HEIGHT}px`,
              color: rightLabelMuted ? "text.disabled" : "text.secondary",
            }}
          >
            {rightLabel}
          </Typography>
        )}
        {actions}
      </ListItemButton>

      {gapAnchor && showQtyGap && (
        <PopperBusinessObjectQtyGap
          anchorEl={gapAnchor}
          businessObject={businessObject}
          computedQty={computedQty}
          gap={qtyGap}
          linkedAnnotations={linkedAnnotations}
          onClose={() => setGapAnchor(null)}
        />
      )}

      {documentsAnchor && (
        <Menu
          anchorEl={documentsAnchor}
          open
          onClose={() => setDocumentsAnchor(null)}
        >
          {documentRels?.map((rel) => (
            <MenuItem
              key={rel.id}
              onClick={() => handleDocumentRelClick(rel)}
              sx={{ maxWidth: 360 }}
            >
              <ListItemText
                primary={rel.text ? `« ${rel.text} »` : rel.resourceName}
                secondary={
                  isWholeResourceRel(rel)
                    ? (rel.resourceName ?? "")
                    : `${rel.resourceName ?? ""} · p. ${rel.pageNumber}`
                }
                slotProps={{
                  primary: { variant: "body2", noWrap: true },
                  secondary: { variant: "caption", noWrap: true },
                }}
              />
            </MenuItem>
          ))}
        </Menu>
      )}

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
