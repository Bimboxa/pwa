import { useDispatch, useSelector } from "react-redux";

import { Box, Paper, Typography, Switch } from "@mui/material";
import { alpha } from "@mui/material/styles";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { keyframes } from "@emotion/react";

import { setPasteDetectionMode } from "Features/mapEditor/mapEditorSlice";
import { isPasteAdjustEligible } from "Features/smartDetect/utils/adjustPasteCandidate";
import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";

// ---------------------------------------------------------------------------
// PopperPasteHelper — floating panel shown while a copy/paste is active
// ---------------------------------------------------------------------------

// Flashing neon-green pulse on the "Espace" badge when a detection is
// available — mirrors CardSmartDetect.
const detectionPulse = keyframes`
  0%   { background-color: #00ff00; box-shadow: 0 0 4px #00ff00; }
  50%  { background-color: #00ff0066; box-shadow: 0 0 10px #00ff00; }
  100% { background-color: #00ff00; box-shadow: 0 0 4px #00ff00; }
`;

function PasteShortcutRow({ label, children }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
      }}
    >
      <Typography
        variant="body2"
        sx={{ color: "text.primary", fontSize: "0.85rem" }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

export default function PopperPasteHelper() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Mode copier/coller";

  // data

  const pasteDetectionMode = useSelector((s) => s.mapEditor.pasteDetectionMode);
  const smartDetectionPresent = useSelector(
    (s) => s.mapEditor.smartDetectionPresent
  );
  const pasteClipboard = useSelector((s) => s.mapEditor.pasteClipboard);

  const copiedCount = pasteClipboard?.items?.length ?? 0;
  // Pattern detection is single-template only.
  const isSingle = copiedCount === 1;
  // "Ajuster" (J) only applies to POLYGON / 2-pt POLYLINE / 2-pt STRIP.
  const isAdjustEligible = isPasteAdjustEligible(pasteClipboard);

  // state

  const { position, isDragging, handleMouseDown } = usePanelDrag();

  // render

  return (
    <Paper
      elevation={4}
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 10,
        width: "fit-content",
        maxWidth: 400,
        display: "flex",
        flexDirection: "column",
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
          bgcolor: "panel.headerBg",
          borderBottom: "1px solid",
          borderColor: "panel.border",
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
        }}
      >
        <DragIndicatorIcon fontSize="small" sx={{ color: "panel.textLight" }} />
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, color: "panel.textMuted" }}
        >
          {titleS}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography
          variant="caption"
          sx={{
            color: "panel.textLight",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {copiedCount > 1 ? `${copiedCount} annotations` : "1 annotation"}
        </Typography>
      </Box>

      <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        {/* Detection card — single-template only; hidden in multi-selection. */}
        {isSingle && (
          <Paper
            variant="outlined"
            sx={{ p: 1, borderRadius: 1, bgcolor: "background.paper" }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Détection automatique
              </Typography>
              <Switch
                size="small"
                checked={pasteDetectionMode === "GLOBAL"}
                onChange={(_e, checked) =>
                  dispatch(setPasteDetectionMode(checked ? "GLOBAL" : null))
                }
              />
              <ShortcutBadge>A</ShortcutBadge>
            </Box>

            <Box
              sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1 }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                Détection au survol
              </Typography>
              <Switch
                size="small"
                checked={pasteDetectionMode === "HOVER"}
                onChange={(_e, checked) =>
                  dispatch(setPasteDetectionMode(checked ? "HOVER" : null))
                }
              />
              <ShortcutBadge>S</ShortcutBadge>
            </Box>

            {isAdjustEligible && (
              <Box
                sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1 }}
              >
                <Typography variant="body2" sx={{ flex: 1 }}>
                  Ajuster
                </Typography>
                <Switch
                  size="small"
                  checked={pasteDetectionMode === "ADJUST"}
                  onChange={(_e, checked) =>
                    dispatch(setPasteDetectionMode(checked ? "ADJUST" : null))
                  }
                />
                <ShortcutBadge>J</ShortcutBadge>
              </Box>
            )}

            {pasteDetectionMode && (
              <Box
                sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1 }}
              >
                <Typography variant="body2" sx={{ flex: 1 }}>
                  Valider la détection
                </Typography>
                <Box
                  component="span"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 56,
                    height: 22,
                    px: 0.5,
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: smartDetectionPresent
                      ? "#00aa00"
                      : "text.disabled",
                    backgroundColor: smartDetectionPresent
                      ? undefined
                      : (theme) => theme.palette.action.hover,
                    borderBottomWidth: "3px",
                    color: smartDetectionPresent ? "#000" : "text.primary",
                    fontFamily: "monospace",
                    fontWeight: "bold",
                    fontSize: "0.7rem",
                    lineHeight: 1,
                    animation: smartDetectionPresent
                      ? `${detectionPulse} 0.8s ease-in-out infinite`
                      : "none",
                  }}
                >
                  Espace
                </Box>
              </Box>
            )}
          </Paper>
        )}

        {/* Keyboard shortcuts card — same style as SectionShortcutHelpers */}
        <Box
          sx={{
            backgroundColor: (theme) =>
              alpha(theme.palette.background.paper, 0.8),
            backdropFilter: "blur(8px)",
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            p: 2,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              mb: 2,
              fontWeight: 600,
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: 1,
              fontSize: "0.75rem",
            }}
          >
            Raccourcis Clavier
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <PasteShortcutRow label="Coller la copie">
              <ShortcutBadge>Clic</ShortcutBadge>
            </PasteShortcutRow>
            <PasteShortcutRow label="Pivoter 90°">
              <ShortcutBadge>R</ShortcutBadge>
            </PasteShortcutRow>
            <PasteShortcutRow label="Miroir">
              <ShortcutBadge>I</ShortcutBadge>
            </PasteShortcutRow>
            <PasteShortcutRow label="Quitter le mode copier/coller">
              <ShortcutBadge>Esc</ShortcutBadge>
            </PasteShortcutRow>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
