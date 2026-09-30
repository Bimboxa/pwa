import { Box, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

// ---------------------------------------------------------------------------
// RowBaseMapInList — one base map of the "Fonds de plan" list, left to right:
// image eye | name (+ version chip) | "3D" scan button | annotations badge.
// Presentational: SectionBaseMapsList resolves the states (main / 2D / 3D)
// and hands the toggles over. `imageEye` / `annotationsBadge` are null when
// the control does not apply (an empty slot keeps the columns aligned).
// ---------------------------------------------------------------------------

const SLOT_SIZE = 22;

export default function RowBaseMapInList({
  name,
  isMain,
  imageEye, // null | { on, onToggle }
  annotationsBadge, // null | { count, on, onToggle } — onToggle null = plain
  scanButton, // null | { on, disabled, onToggle }
  versionChip, // null | { label, onOpen }
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

  // helpers

  const badgeOn = Boolean(annotationsBadge?.on);
  const badgeClickable = Boolean(annotationsBadge?.onToggle);

  // handlers

  function stop(e, fn) {
    e.stopPropagation();
    fn?.();
  }

  // render

  return (
    <Box
      onClick={isMain ? undefined : onSelect}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        px: 1,
        py: 0.5,
        borderBottom: "1px solid",
        borderColor: "panel.border",
        cursor: isMain ? "default" : "pointer",
        bgcolor: (theme) =>
          isMain ? alpha(theme.palette.primary.main, 0.06) : "transparent",
        "&:hover": { bgcolor: isMain ? undefined : "panel.headerBg" },
      }}
    >
      {/* Image eye */}
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
            <Box
              role="button"
              onClick={(e) => stop(e, imageEye.onToggle)}
              sx={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                color: imageEye.on ? "panel.iconMuted" : "panel.textLight",
                "&:hover": { color: "panel.textPrimary" },
              }}
            >
              {imageEye.on ? (
                <Visibility sx={{ fontSize: 18 }} />
              ) : (
                <VisibilityOff sx={{ fontSize: 18 }} />
              )}
            </Box>
          </Tooltip>
        )}
      </Box>

      {/* Name */}
      <Tooltip title={isMain ? "" : selectS} disableInteractive>
        <Typography
          variant="body2"
          noWrap
          sx={{
            flex: 1,
            minWidth: 0,
            fontWeight: isMain ? 700 : 400,
            color: isMain ? "primary.main" : "panel.textPrimary",
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
              borderColor: "panel.border",
              cursor: "pointer",
              flexShrink: 0,
              "&:hover": { bgcolor: "panel.sectionBg" },
            }}
          >
            <Typography
              variant="caption"
              noWrap
              sx={{ color: "panel.textSecondary", maxWidth: 70 }}
            >
              {versionChip.label}
            </Typography>
            <ArrowDropDownIcon
              sx={{ fontSize: 16, color: "panel.iconMuted" }}
            />
          </Box>
        </Tooltip>
      )}

      {/* "3D" scan button */}
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
                badgeClickable && badgeOn ? "transparent" : "divider",
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
                      ? "text.disabled"
                      : annotationsBadge.count > 0
                        ? "secondary.main"
                        : "panel.countEmpty",
              }}
            >
              {annotationsBadge.count}
            </Typography>
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}
