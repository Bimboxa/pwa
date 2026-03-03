import { useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedListingId,
  setHiddenListingsIds,
} from "Features/listings/listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import {
  Box,
  Paper,
  Typography,
  List,
  ListItemButton,
  IconButton,
  InputBase,
  Popper,
  Fade,
  Collapse,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Add from "@mui/icons-material/Add";
import Remove from "@mui/icons-material/Remove";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { Edit, Check, Close } from "@mui/icons-material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import ToolbarCreateAnnotationFromTabAnnotationTemplates from "Features/annotations/components/ToolbarCreateAnnotationFromTabAnnotationTemplates";
import DialogCreateAnnotationTemplate from "Features/annotations/components/DialogCreateAnnotationTemplate";
import DialogCreateListing from "Features/listings/components/DialogCreateListing";
import SectionSmartDetect from "Features/smartDetect/components/SectionSmartDetect";
import SectionShortcutHelpers from "Features/annotations/components/SectionShortcutHelpers";

import useListings from "Features/listings/hooks/useListings";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationTemplateCountById from "Features/annotations/hooks/useAnnotationTemplateCountById";
import useAnnotationTemplateQtiesById from "Features/annotations/hooks/useAnnotationTemplateQtiesById";
import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";

// ---------------------------------------------------------------------------
// AnnotationTemplateRow — one template inside an expanded listing
// ---------------------------------------------------------------------------

function AnnotationTemplateRow({
  annotationTemplate,
  count,
  qtyLabel,
  listingId,
}) {
  const dispatch = useDispatch();
  const updateAnnotationTemplate = useUpdateAnnotationTemplate();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState("");
  const hoverTimeoutRef = useRef(null);
  const isOpen = Boolean(anchorEl) && !isEditing;

  // handlers

  const handleListItemEnter = (event) => {
    setIsHovered(true);
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setAnchorEl(event.currentTarget);
    // Ensure selectedListingId is set so annotation creation uses the correct listing
    dispatch(setSelectedListingId(listingId));
  };

  const handleListItemLeave = () => {
    setIsHovered(false);
    hoverTimeoutRef.current = setTimeout(() => {
      setAnchorEl(null);
    }, 50);
  };

  const handlePopperEnter = () => {
    setIsHovered(true);
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const handleToggleHidden = async (e) => {
    e.stopPropagation();
    await updateAnnotationTemplate({
      ...annotationTemplate,
      hidden: !annotationTemplate?.hidden,
    });
  };

  const handleStartEdit = (e) => {
    e.stopPropagation();
    setTempLabel(annotationTemplate.label ?? "");
    setIsEditing(true);
  };

  const handleConfirmEdit = async () => {
    await updateAnnotationTemplate({
      ...annotationTemplate,
      label: tempLabel,
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleClick = (e) => {
    if (isEditing) return;
    dispatch(setSelectedListingId(listingId));
    dispatch(
      setSelectedItem({
        id: annotationTemplate?.id,
        type: "ANNOTATION_TEMPLATE",
      })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  };

  // helpers

  const isHidden = annotationTemplate?.hidden;

  // render

  return (
    <Box>
      <ListItemButton
        onClick={handleClick}
        onMouseEnter={handleListItemEnter}
        onMouseLeave={handleListItemLeave}
        sx={{
          position: "relative",
          bgcolor: "white",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1,
          py: 0.5,
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: "24px",
              opacity: isHidden ? 0.4 : 1,
              filter: isHidden ? "grayscale(100%)" : "none",
              mr: 1,
            }}
          >
            <AnnotationTemplateIcon template={annotationTemplate} size={18} />
          </Box>
          {isEditing ? (
            <InputBase
              value={tempLabel}
              onChange={(e) => setTempLabel(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleConfirmEdit();
                else if (e.key === "Escape") handleCancelEdit();
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              sx={{ fontSize: "0.875rem", flex: 1 }}
            />
          ) : (
            <Typography
              variant="body2"
              color={isHidden ? "text.disabled" : "text.primary"}
              sx={{ lineHeight: 1.3 }}
              noWrap
            >
              {annotationTemplate.label}
            </Typography>
          )}
        </Box>

        {/* Right side: edit confirm/cancel OR hover actions OR qty */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 0.5,
            ml: 1,
            minWidth: 56,
            flexShrink: 0,
          }}
        >
          {isEditing ? (
            <>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirmEdit();
                }}
                sx={{ color: "success.main", p: 0.5 }}
              >
                <Check fontSize="inherit" sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelEdit();
                }}
                sx={{ color: "error.main", p: 0.5 }}
              >
                <Close fontSize="inherit" sx={{ fontSize: 16 }} />
              </IconButton>
            </>
          ) : isHovered ? (
            <>
              <IconButton
                size="small"
                onClick={handleStartEdit}
                sx={{ p: 0.5 }}
              >
                <Edit fontSize="inherit" sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton
                size="small"
                onClick={handleToggleHidden}
                sx={{ p: 0.5 }}
              >
                {isHidden ? (
                  <VisibilityOff fontSize="inherit" sx={{ fontSize: 16 }} />
                ) : (
                  <Visibility fontSize="inherit" sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </>
          ) : (
            <Typography
              align="right"
              noWrap
              sx={{ fontSize: "12px", minWidth: "40px" }}
              color={
                isHidden
                  ? "text.disabled"
                  : count > 0
                    ? "secondary.main"
                    : "grey.200"
              }
            >
              {qtyLabel}
            </Typography>
          )}
        </Box>
      </ListItemButton>

      {/* Drawing toolbar popper on hover */}
      <Popper
        open={isOpen}
        anchorEl={anchorEl}
        placement="right"
        transition
        modifiers={[{ name: "offset", options: { offset: [0, 16] } }]}
        style={{ zIndex: 1500 }}
        onMouseEnter={handlePopperEnter}
        onMouseLeave={handleListItemLeave}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={100}>
            <Paper
              elevation={6}
              sx={{
                display: "flex",
                alignItems: "center",
                borderRadius: 1.5,
                bgcolor: "background.paper",
                position: "relative",
                border: "1px solid",
                borderColor: "divider",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: -18,
                  top: 0,
                  width: 18,
                  height: "100%",
                  bgcolor: "transparent",
                },
                "&::after": {
                  content: '""',
                  position: "absolute",
                  left: -5,
                  top: "50%",
                  transform: "translateY(-50%) rotate(45deg)",
                  width: 10,
                  height: 10,
                  bgcolor: "background.paper",
                  borderLeft: "1px solid",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                },
              }}
            >
              <ToolbarCreateAnnotationFromTabAnnotationTemplates
                annotationTemplate={annotationTemplate}
              />
            </Paper>
          </Fade>
        )}
      </Popper>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// AnnotationTemplatesForListing — templates list for one expanded listing
// ---------------------------------------------------------------------------

function AnnotationTemplatesForListing({ listingId }) {
  // data

  const annotationTemplates = useAnnotationTemplates({
    filterByListingId: listingId,
    sortByLabel: true,
  });
  const annotationTemplateCountById = useAnnotationTemplateCountById();
  const annotationTemplateQtiesById = useAnnotationTemplateQtiesById();

  // state

  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  // render

  return (
    <Box sx={{ pl: 2 }}>
      <List dense disablePadding>
        {annotationTemplates?.map((template) => {
          if (template?.isDivider) return null;
          const count =
            annotationTemplateCountById?.[template.id] || 0;
          const qtyLabel =
            annotationTemplateQtiesById?.[template.id]?.mainQtyLabel;
          return (
            <AnnotationTemplateRow
              key={template.id}
              annotationTemplate={template}
              count={count}
              qtyLabel={qtyLabel}
              listingId={listingId}
            />
          );
        })}
      </List>

      {/* + Nouveau modele */}
      <Box
        onClick={() => setOpenCreateDialog(true)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.5,
          cursor: "pointer",
          color: "text.secondary",
          "&:hover": { color: "primary.main" },
        }}
      >
        <Add sx={{ fontSize: 16 }} />
        <Typography variant="body2">Nouveau modèle</Typography>
      </Box>

      {openCreateDialog && (
        <DialogCreateAnnotationTemplate
          open={openCreateDialog}
          onClose={() => setOpenCreateDialog(false)}
          listingId={listingId}
        />
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// ListingRow — one listing with expand/collapse and visibility toggle
// ---------------------------------------------------------------------------

function ListingRow({ listing, isExpanded, onToggleExpand, hiddenListingsIds }) {
  const dispatch = useDispatch();

  // state

  const [isHovered, setIsHovered] = useState(false);

  // helpers

  const isHidden = hiddenListingsIds?.includes(listing.id);

  // handlers

  function handleToggleVisibility(e) {
    e.stopPropagation();
    const next = isHidden
      ? hiddenListingsIds.filter((id) => id !== listing.id)
      : [...hiddenListingsIds, listing.id];
    dispatch(setHiddenListingsIds(next));
  }

  // render

  return (
    <Box>
      <Box
        onClick={() => onToggleExpand(listing.id)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1,
          py: 0.75,
          cursor: "pointer",
          "&:hover": { bgcolor: "action.hover" },
          borderBottom: "1px solid",
          borderColor: "divider",
          opacity: isHidden ? 0.5 : 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flex: 1, minWidth: 0 }}>
          {isExpanded ? (
            <Remove sx={{ fontSize: 18, color: "text.secondary" }} />
          ) : (
            <Add sx={{ fontSize: 18, color: "secondary.main" }} />
          )}
          <Typography
            variant="body2"
            sx={{ fontWeight: 500 }}
            noWrap
          >
            {listing.name ?? listing.label ?? "Liste"}
          </Typography>
        </Box>

        {/* Eye icon on hover */}
        <IconButton
          size="small"
          onClick={handleToggleVisibility}
          sx={{ p: 0.25, visibility: isHovered ? "visible" : "hidden" }}
        >
          {isHidden ? (
            <VisibilityOff sx={{ fontSize: 18 }} />
          ) : (
            <Visibility sx={{ fontSize: 18 }} />
          )}
        </IconButton>
      </Box>

      <Collapse in={isExpanded}>
        {isExpanded && (
          <AnnotationTemplatesForListing listingId={listing.id} />
        )}
      </Collapse>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// PopperDrawingHelper — floating panel shown while drawing
// ---------------------------------------------------------------------------

function PopperDrawingHelper() {
  // strings

  const titleS = "Mode dessin";

  // state

  const { position, isDragging, handleMouseDown } = usePanelDrag();

  // render

  return (
    <Paper
      elevation={4}
      sx={{
        position: "absolute",
        top: 60,
        left: 16,
        zIndex: 10,
        width: 280,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 2,
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging.current ? "none" : "transform 0.1s ease-out",
      }}
    >
      {/* Drag handle header */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.75,
          bgcolor: "grey.100",
          borderBottom: "1px solid",
          borderColor: "divider",
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
        }}
      >
        <DragIndicatorIcon fontSize="small" sx={{ color: "text.secondary" }} />
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, color: "text.secondary" }}
        >
          {titleS}
        </Typography>
      </Box>

      <SectionSmartDetect />

      <Box sx={{ p: 1 }}>
        <SectionShortcutHelpers />
      </Box>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// PopperMapListings — main floating panel (or drawing helper when drawing)
// ---------------------------------------------------------------------------

export default function PopperMapListings() {
  // strings

  const titleS = "Créer une annotation";
  const addListS = "Ajouter une liste";

  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const enabledDrawingMode = useSelector(
    (s) => s.mapEditor.enabledDrawingMode
  );
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );

  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
  });

  // state

  const [expandedListingIds, setExpandedListingIds] = useState([]);
  const [openCreateListing, setOpenCreateListing] = useState(false);
  const { position, isDragging, handleMouseDown } = usePanelDrag();

  // handlers

  function handleToggleExpand(listingId) {
    setExpandedListingIds((prev) =>
      prev.includes(listingId)
        ? prev.filter((id) => id !== listingId)
        : [...prev, listingId]
    );
  }

  // render

  if (Boolean(enabledDrawingMode)) {
    return <PopperDrawingHelper />;
  }

  if (!listings?.length && !openCreateListing) return null;

  return (
    <Paper
      elevation={4}
      sx={{
        position: "absolute",
        top: 60,
        left: 16,
        zIndex: 10,
        width: 280,
        maxHeight: "calc(100% - 32px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 2,
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging.current ? "none" : "transform 0.1s ease-out",
      }}
    >
      {/* Drag handle header */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.75,
          bgcolor: "grey.100",
          borderBottom: "1px solid",
          borderColor: "divider",
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
        }}
      >
        <DragIndicatorIcon fontSize="small" sx={{ color: "text.secondary" }} />
        <Typography variant="body2" sx={{ fontWeight: 500, color: "text.secondary" }}>
          {titleS}
        </Typography>
      </Box>

      {/* Scrollable listings */}
      <Box sx={{ overflow: "auto", flex: 1 }}>
        {listings?.map((listing) => (
          <ListingRow
            key={listing.id}
            listing={listing}
            isExpanded={expandedListingIds.includes(listing.id)}
            onToggleExpand={handleToggleExpand}
            hiddenListingsIds={hiddenListingsIds}
          />
        ))}

        {/* + Ajouter une liste */}
        <Box
          onClick={() => setOpenCreateListing(true)}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1,
            py: 1,
            cursor: "pointer",
            color: "text.secondary",
            "&:hover": { color: "primary.main" },
          }}
        >
          <Add sx={{ fontSize: 16 }} />
          <Typography variant="body2">{addListS}</Typography>
        </Box>
      </Box>

      {/* Create listing dialog */}
      {openCreateListing && (
        <DialogCreateListing
          open={openCreateListing}
          onClose={() => setOpenCreateListing(false)}
          fromPresetListings={false}
        />
      )}
    </Paper>
  );
}
