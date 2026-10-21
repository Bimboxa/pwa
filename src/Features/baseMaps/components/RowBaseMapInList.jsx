import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Box, IconButton, InputBase, Tooltip, Typography } from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import Check from "@mui/icons-material/Check";
import Close from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import LayersIcon from "@mui/icons-material/Layers";

// ---------------------------------------------------------------------------
// RowBaseMapInList — one base map of the "Fonds de plan" list, left to right:
// drag handle | name (+ version chip) | "3D" scan button | annotations badge
// | image eye | actions. The handle (shown on hover, `canDrag`) reorders the
// row inside its listing — the row must live in a dnd-kit SortableContext.
// The name wraps on several lines rather than being truncated.
// Presentational: SectionBaseMapsList resolves the states (main / 2D / 3D)
// and hands the toggles over. `imageEye` / `annotationsBadge` are null when
// the control does not apply (an empty slot keeps the columns aligned).
// `actions`: an optional trailing node (the "…" menu of the Fonds de plan
// module). `renaming`: inline rename mode — the name becomes an input and
// the right-hand controls give way to the confirm / cancel buttons.
// ---------------------------------------------------------------------------

const SLOT_SIZE = 22;

export default function RowBaseMapInList({
  id,
  listingId, // the folder of the row (dnd data: cross-folder drops)
  name,
  canDrag = false,
  isMain,
  imageEye, // null | { on, onToggle }
  annotationsBadge, // null | { count, on, onToggle } — onToggle null = plain
  scanButton, // null | { on, disabled, onToggle }
  versionChip, // null | { label, onOpen }
  actions = null, // null | ReactNode
  renaming = null, // null | { value, onChange, onConfirm, onCancel }
  onSelect,
}) {
  // strings

  const selectS = "Sélectionner ce fond de plan";
  const hideImageS = "Masquer l'image du fond de plan";
  const showImageS = "Afficher l'image du fond de plan";
  const hideAnnotationsS = "Masquer les annotations";
  const showAnnotationsS = "Afficher les annotations";
  const hideScanS = "Masquer le scan 3D";
  const showScanS = "Afficher le scan 3D";
  const scanOffS = "Scan non affiché (Affichage 3D : projection / masqué)";
  const versionS = "Changer de version";

  // data

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: !canDrag,
    data: { type: "baseMap", listingId },
  });

  // helpers

  const badgeOn = Boolean(annotationsBadge?.on);
  const badgeClickable = Boolean(annotationsBadge?.onToggle);

  // handlers

  function stop(e, fn) {
    e.stopPropagation();
    fn?.();
  }

  // render

  if (renaming) {
    return (
      <Box
        ref={setNodeRef}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: 1,
          pr: 0.5,
          py: 0.25,
          borderBottom: "1px solid",
          borderColor: "panel.border",
          borderLeft: "3px solid",
          borderLeftColor: isMain ? "secondary.main" : "transparent",
        }}
      >
        <InputBase
          value={renaming.value}
          onChange={(e) => renaming.onChange(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") renaming.onConfirm();
            else if (e.key === "Escape") renaming.onCancel();
          }}
          autoFocus
          sx={{ fontSize: "0.875rem", flex: 1, minWidth: 0 }}
        />
        <IconButton
          size="small"
          onClick={renaming.onConfirm}
          sx={{ color: "success.main", p: 0.25 }}
        >
          <Check sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={renaming.onCancel}
          sx={{ color: "error.main", p: 0.25 }}
        >
          <Close sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      onClick={isMain ? undefined : onSelect}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        pl: 0.25,
        pr: 1,
        py: 0.5,
        "&:hover .drag-handle": { opacity: canDrag ? 1 : 0 },
        borderBottom: "1px solid",
        borderColor: "panel.border",
        // Main (selected) row: the dark pill of the top bar base map
        // selector (BaseMapSelectorInMapEditorV2) — black background, white
        // name, grey "off" chips — plus the 3px secondary left border.
        borderLeft: "3px solid",
        borderLeftColor: isMain ? "secondary.main" : "transparent",
        cursor: isMain ? "default" : "pointer",
        bgcolor: isMain ? "#252525" : "transparent",
        "&:hover": {
          bgcolor: (theme) => (isMain ? "#333" : theme.palette.panel.headerBg),
        },
      }}
    >
      {/* Drag handle — far left, on hover (reorder inside the listing) */}
      <Box
        className="drag-handle"
        {...(canDrag ? listeners : {})}
        onClick={(e) => e.stopPropagation()}
        sx={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          cursor: canDrag ? "grab" : "default",
          opacity: 0,
          transition: "opacity 0.15s",
          touchAction: "none",
        }}
      >
        <DragIndicatorIcon sx={{ fontSize: 16, color: "panel.textLight" }} />
      </Box>

      {/* Name */}
      <Tooltip title={isMain ? "" : selectS} disableInteractive>
        <Typography
          variant="body2"
          sx={{
            flex: 1,
            minWidth: 0,
            // several lines rather than an ellipsis
            overflowWrap: "anywhere",
            lineHeight: 1.25,
            fontWeight: isMain ? 700 : 400,
            color: isMain ? "#ffffff" : "panel.textPrimary",
          }}
        >
          {name}
        </Typography>
      </Tooltip>

      {/* Version chip (Viewer module, main row with several versions) */}
      {versionChip && (
        <Tooltip title={versionS} disableInteractive>
          <Box
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              versionChip.onOpen(e);
            }}
            sx={{
              display: "flex",
              alignItems: "center",
              px: 0.5,
              borderRadius: "8px",
              border: "1px solid",
              // Main row only: on the dark background.
              borderColor: "rgba(255,255,255,0.25)",
              cursor: "pointer",
              flexShrink: 0,
              "&:hover": { bgcolor: "#333" },
            }}
          >
            <Typography
              variant="caption"
              noWrap
              sx={{ color: "grey.300", maxWidth: 70 }}
            >
              {versionChip.label}
            </Typography>
            <ArrowDropDownIcon sx={{ fontSize: 16, color: "grey.400" }} />
          </Box>
        </Tooltip>
      )}

      {/* "3D" scan button — scan base maps only, left of the badge */}
      {scanButton && (
        <Tooltip
          title={
            scanButton.disabled
              ? scanOffS
              : scanButton.on
                ? hideScanS
                : showScanS
          }
          disableInteractive
        >
          <Box
            role="button"
            aria-disabled={scanButton.disabled || undefined}
            onClick={(e) =>
              stop(e, scanButton.disabled ? null : scanButton.onToggle)
            }
            sx={{
              px: 0.75,
              py: 0.125,
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              bgcolor: scanButton.on ? "secondary.main" : "transparent",
              border: "1px solid",
              borderColor: scanButton.on ? "transparent" : "divider",
              opacity: scanButton.disabled ? 0.4 : 1,
              cursor: scanButton.disabled ? "default" : "pointer",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                lineHeight: 1.4,
                color: scanButton.on
                  ? "secondary.contrastText"
                  : "text.disabled",
              }}
            >
              3D
            </Typography>
          </Box>
        </Tooltip>
      )}

      {/* Annotations badge */}
      {annotationsBadge && (
        <Tooltip
          title={
            badgeClickable
              ? badgeOn
                ? hideAnnotationsS
                : showAnnotationsS
              : ""
          }
          disableInteractive
        >
          <Box
            role={badgeClickable ? "button" : undefined}
            onClick={
              badgeClickable
                ? (e) => stop(e, annotationsBadge.onToggle)
                : (e) => e.stopPropagation()
            }
            sx={{
              minWidth: 24,
              px: 0.75,
              py: 0.125,
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              bgcolor:
                badgeClickable && badgeOn ? "secondary.main" : "transparent",
              border: "1px solid",
              borderColor:
                badgeClickable && badgeOn
                  ? "transparent"
                  : isMain
                    ? "rgba(255,255,255,0.25)"
                    : "divider",
              cursor: badgeClickable ? "pointer" : "default",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                lineHeight: 1.4,
                fontFamily: "monospace",
                color:
                  badgeClickable && badgeOn
                    ? "secondary.contrastText"
                    : badgeClickable
                      ? isMain
                        ? "grey.400"
                        : "text.disabled"
                      : annotationsBadge.count > 0
                        ? "secondary.main"
                        : isMain
                          ? "grey.500"
                          : "panel.countEmpty",
              }}
            >
              {annotationsBadge.count}
            </Typography>
          </Box>
        </Tooltip>
      )}

      {/* Image eye — far right slot (empty when it does not apply) */}
      <Box
        sx={{
          width: SLOT_SIZE,
          height: SLOT_SIZE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {imageEye && (
          <Tooltip
            title={imageEye.on ? hideImageS : showImageS}
            disableInteractive
          >
            {/* Same "layer" chip as the top bar base map selector: filled
                in secondary while the image is shown, outlined otherwise. */}
            <Box
              role="button"
              onClick={(e) => stop(e, imageEye.onToggle)}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "1px solid",
                borderColor:
                  imageEye.on || isMain ? "transparent" : "panel.border",
                bgcolor: imageEye.on
                  ? "secondary.main"
                  : isMain
                    ? "grey.700"
                    : "transparent",
                color: imageEye.on
                  ? "secondary.contrastText"
                  : isMain
                    ? "grey.400"
                    : "text.disabled",
                cursor: "pointer",
                transition: "0.2s",
                "&:hover": {
                  filter: "brightness(1.15)",
                  borderColor:
                    imageEye.on || isMain ? "transparent" : "text.secondary",
                },
              }}
            >
              <LayersIcon sx={{ fontSize: 13 }} />
            </Box>
          </Tooltip>
        )}
      </Box>

      {/* Trailing actions ("…" menu of the Fonds de plan module) */}
      {actions && (
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}
        >
          {actions}
        </Box>
      )}
    </Box>
  );
}
