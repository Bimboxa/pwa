import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Typography,
} from "@mui/material";
import { Close } from "@mui/icons-material";

import SectionCompareTwoImages from "Features/baseMapTransforms/components/SectionCompareTwoImages";

import useCaptureFrameBounds from "../hooks/useCaptureFrameBounds";

// In-frame overlay of the POV "Amélioration IA" flow: laid exactly over the
// capture frame (no dialog). While the transformation endpoint works, the
// captured view shows under a sweeping shine; a fixed backdrop blocks every
// click in the app except the top-right "Quitter" (X) button. Once done, the
// original/enhanced comparison slider replaces it, with "Enregistrer
// l'image d'origine" (left, original side) and "Enregistrer l'image
// améliorée" (right, enhanced side).
export default function PovAiEnhanceFrameOverlay({
  state,
  onClose,
  onSaveEnhanced,
}) {
  // strings

  const waitingS = "Amélioration en cours...";
  const errorS = "L'amélioration a échoué. Réessayez plus tard.";
  const quitS = "Quitter";
  const saveOriginalS = "Enregistrer l'image d'origine";
  const saveEnhancedS = "Enregistrer l'image améliorée";

  // data

  const bounds = useCaptureFrameBounds();

  // helpers

  const { originalUrl, enhancedUrl, enhancedBlob, loading, error } =
    state ?? {};
  const screenRect = bounds?.screenRect;

  // handlers

  function handleSaveEnhanced() {
    if (enhancedBlob) onSaveEnhanced?.(enhancedBlob);
  }

  // render

  return (
    // Fixed backdrop: catches (and blocks) every click outside the frame
    // while the flow is active.
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: (theme) => theme.zIndex.modal,
        bgcolor: "rgba(0,0,0,0.15)",
      }}
    >
      {screenRect && (
        <Box
          sx={{
            position: "absolute",
            left: screenRect.left,
            top: screenRect.top,
            width: screenRect.width,
            height: screenRect.height,
            overflow: "hidden",
            bgcolor: "grey.100",
          }}
        >
          {/* RESULT: original (left) vs enhanced (right) comparison slider */}
          {enhancedUrl && (
            <Box
              sx={{
                width: 1,
                height: 1,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <SectionCompareTwoImages
                imageUrl1={enhancedUrl}
                imageUrl2={originalUrl}
              />
            </Box>
          )}

          {/* WAITING / ERROR: the captured view under a sweeping shine */}
          {!enhancedUrl && originalUrl && (
            <Box
              component="img"
              src={originalUrl}
              alt=""
              sx={{
                width: 1,
                height: 1,
                display: "block",
                objectFit: "cover",
                opacity: loading ? 0.6 : 1,
                filter: loading ? "saturate(0.6)" : "none",
                transition: "opacity 0.3s",
              }}
            />
          )}

          {loading && (
            <>
              {/* twinkling dots, uniformly spread over the image: two offset
                  dot grids blinking in opposite phase */}
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage:
                    "radial-gradient(circle, rgba(255,255,255,0.9) 2.5px, transparent 3.5px)",
                  backgroundSize: "32px 32px",
                  animation: "povTwinkleA 1.6s ease-in-out infinite",
                  "@keyframes povTwinkleA": {
                    "0%, 100%": { opacity: 0.1 },
                    "50%": { opacity: 0.9 },
                  },
                  pointerEvents: "none",
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage:
                    "radial-gradient(circle, rgba(255,255,255,0.9) 2.5px, transparent 3.5px)",
                  backgroundSize: "32px 32px",
                  backgroundPosition: "16px 16px",
                  animation: "povTwinkleB 1.6s ease-in-out infinite",
                  "@keyframes povTwinkleB": {
                    "0%, 100%": { opacity: 0.9 },
                    "50%": { opacity: 0.1 },
                  },
                  pointerEvents: "none",
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1.5,
                    bgcolor: "rgba(255,255,255,0.85)",
                    borderRadius: 2,
                    px: 3,
                    py: 2,
                    boxShadow: 3,
                  }}
                >
                  <CircularProgress size={28} color="secondary" />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {waitingS}
                  </Typography>
                </Box>
              </Box>
            </>
          )}

          {error && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Box
                sx={{
                  bgcolor: "rgba(255,255,255,0.9)",
                  borderRadius: 2,
                  px: 3,
                  py: 2,
                  boxShadow: 3,
                }}
              >
                <Typography variant="body2" color="error">
                  {errorS}
                </Typography>
              </Box>
            </Box>
          )}

          {/* SAVE BUTTONS (result only) — one per slider side */}
          {enhancedUrl && (
            <>
              <Button
                variant="contained"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={onClose}
                sx={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  textTransform: "none",
                  bgcolor: "white",
                  color: "text.primary",
                  boxShadow: 3,
                  "&:hover": { bgcolor: "grey.100" },
                }}
              >
                {saveOriginalS}
              </Button>
              <Button
                variant="contained"
                color="secondary"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={handleSaveEnhanced}
                sx={{
                  position: "absolute",
                  bottom: 12,
                  right: 12,
                  textTransform: "none",
                  boxShadow: 3,
                }}
              >
                {saveEnhancedS}
              </Button>
            </>
          )}

          {/* QUITTER (X) — always available, incl. during the generation */}
          <IconButton
            size="small"
            title={quitS}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              bgcolor: "white",
              boxShadow: 3,
              "&:hover": { bgcolor: "grey.100" },
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
