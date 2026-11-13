import { useDispatch } from "react-redux";

import { setRevolutionOnCommit } from "Features/mapEditor/mapEditorSlice";

import { Box, Paper, Switch, Typography } from "@mui/material";

import useDrawingRevolutionAxis from "../hooks/useDrawingRevolutionAxis";

// « Forme 3D » section of the 2D drawing helper, shown while drawing a
// profile / point on a base map that carries the clone of a revolution axis
// (the inverted T): the « Révolution · <axis> » switch (hotkey R, on by
// default) revolves what is drawn around that axis — the commit stamps the
// REVOLUTION shape3D (useHandleCommitDrawing). Null otherwise.
export default function SectionDrawingShape3D() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Forme 3D";
  const revolutionS = "Révolution";

  // data

  const { axis, enabled } = useDrawingRevolutionAxis();

  // render

  if (!axis) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        px: 1,
        py: 0.75,
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
        gap: 0.25,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 600,
        }}
      >
        {titleS}
      </Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
        >
          <Typography variant="body2" noWrap>
            {axis.label ? `${revolutionS} · ${axis.label}` : revolutionS}
          </Typography>
          <Box
            sx={{
              px: 0.5,
              py: 0,
              borderRadius: 0.5,
              bgcolor: "action.hover",
              color: "text.secondary",
              fontSize: "0.65rem",
              fontWeight: 600,
              lineHeight: 1.4,
              flexShrink: 0,
            }}
          >
            R
          </Box>
        </Box>
        <Switch
          size="small"
          checked={enabled}
          onChange={(e) => dispatch(setRevolutionOnCommit(e.target.checked))}
        />
      </Box>
    </Paper>
  );
}
