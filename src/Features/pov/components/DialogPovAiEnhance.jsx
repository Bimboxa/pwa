import { Box, CircularProgress, Typography } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import SectionCompareTwoImages from "Features/baseMapTransforms/components/SectionCompareTwoImages";

import downloadBlob from "Features/files/utils/downloadBlob";

// Centered dialog of the POV "Amélioration IA" flow: shows the captured view
// with a sweeping-shine waiting effect while the transformation endpoint
// works, then the original/enhanced comparison slider (same principle as the
// baseMap "Transformation IA" result).
export default function DialogPovAiEnhance({ state, onClose }) {
  // strings

  const waitingS = "Amélioration en cours...";
  const errorS = "L'amélioration a échoué. Réessayez plus tard.";
  const downloadS = "Télécharger";

  // helpers

  const { originalUrl, enhancedUrl, enhancedBlob, loading, error } =
    state ?? {};

  // handlers

  function handleDownload() {
    if (enhancedBlob) downloadBlob(enhancedBlob, "vue_amelioree.png");
  }

  // render

  return (
    <DialogGeneric open={Boolean(state)} onClose={onClose} vh={90}>
      <BoxFlexVStretch sx={{ width: 1, height: 1, position: "relative" }}>
        {/* Result: original vs enhanced comparison slider */}
        {enhancedUrl && (
          <>
            <SectionCompareTwoImages
              imageUrl1={enhancedUrl}
              imageUrl2={originalUrl}
            />
            <Box
              sx={{
                position: "absolute",
                bottom: 8,
                right: 8,
                bgcolor: "white",
                borderRadius: 1,
                px: 1.5,
                py: 0.5,
                boxShadow: 2,
              }}
            >
              <ButtonGeneric
                label={downloadS}
                variant="contained"
                color="secondary"
                onClick={handleDownload}
              />
            </Box>
          </>
        )}

        {/* Waiting: the captured view under a sweeping shine + progress */}
        {!enhancedUrl && (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              bgcolor: "grey.100",
            }}
          >
            {originalUrl && (
              <Box
                component="img"
                src={originalUrl}
                alt=""
                sx={{
                  maxWidth: 1,
                  maxHeight: 1,
                  objectFit: "contain",
                  opacity: loading ? 0.6 : 1,
                  filter: loading ? "saturate(0.6)" : "none",
                  transition: "opacity 0.3s",
                }}
              />
            )}

            {loading && (
              <>
                {/* sweeping shine */}
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.75) 50%, transparent 60%)",
                    backgroundSize: "300% 100%",
                    animation: "povShine 1.8s ease-in-out infinite",
                    "@keyframes povShine": {
                      "0%": { backgroundPosition: "120% 0" },
                      "100%": { backgroundPosition: "-80% 0" },
                    },
                    pointerEvents: "none",
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
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
              </>
            )}

            {error && (
              <Box
                sx={{
                  position: "absolute",
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
            )}
          </Box>
        )}
      </BoxFlexVStretch>
    </DialogGeneric>
  );
}
