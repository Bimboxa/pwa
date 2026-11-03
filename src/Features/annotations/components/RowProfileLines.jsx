import { useState } from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { SwapHoriz as SwapHorizIcon } from "@mui/icons-material";

import mirrorProfileLineService, {
  MIRROR_ERROR_MESSAGES,
} from "Features/elevation/services/mirrorProfileLineService";

// Rows of ToolbarEditAnnotation listing the inline profiles of a POLYLINE
// (annotation.profileLines — « Ajouter un profil », 2D or 3D): one row per
// profile with « Inverser », which swaps the profile to the other side of
// the guide line (mirrorProfileLineService, Ctrl+Z restores). Self-hiding
// without profile.
export default function RowProfileLines({ annotation, accentColor }) {
  const dispatch = useDispatch();

  // strings

  const labelS = (i, n) => `Profil ${i + 1} (${n} points)`;
  const mirrorS = "Inverser le côté du profil par rapport à la ligne guide";
  const doneS = "Profil inversé (Ctrl+Z pour annuler)";
  const failedS = "Inversion impossible";

  // data

  const lines = (annotation?.profileLines ?? [])
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => (line?.points?.length ?? 0) >= 2);

  // state

  const [busyIndex, setBusyIndex] = useState(null);

  // handlers

  async function handleMirror(index) {
    if (!annotation?.id || busyIndex != null) return;
    setBusyIndex(index);
    try {
      const result = await mirrorProfileLineService({
        annotationId: annotation.id,
        index,
        dispatch,
      });
      if (result?.error) {
        dispatch(
          setToaster({
            message: MIRROR_ERROR_MESSAGES[result.error] ?? failedS,
            severity: "warning",
          })
        );
        return;
      }
      dispatch(setToaster({ message: doneS, severity: "success" }));
    } catch (e) {
      console.error("[profileLines] mirror", e);
      dispatch(setToaster({ message: failedS, severity: "error" }));
    } finally {
      setBusyIndex(null);
    }
  }

  // render

  if (!annotation?.id || !lines.length) return null;

  return lines.map(({ line, index }) => (
    <Box
      key={index}
      sx={{
        display: "flex",
        alignItems: "center",
        px: 1.25,
        py: 0.25,
        gap: 0.5,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {labelS(index, line.points.length)}
      </Typography>
      <Box sx={{ flex: 1 }} />
      <Tooltip title={mirrorS}>
        <span>
          <IconButton
            size="small"
            onClick={() => handleMirror(index)}
            disabled={busyIndex != null}
            sx={{
              color: "text.disabled",
              "&:hover": {
                color: accentColor || "text.primary",
                bgcolor: (accentColor || "#000") + "18",
              },
            }}
          >
            <SwapHorizIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  ));
}

RowProfileLines.propTypes = {
  annotation: PropTypes.shape({
    id: PropTypes.string,
    profileLines: PropTypes.arrayOf(
      PropTypes.shape({ points: PropTypes.array })
    ),
  }),
  accentColor: PropTypes.string,
};
