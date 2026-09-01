import { useSelector, useDispatch } from "react-redux";

import { setVertexSizeMultiplier } from "Features/mapEditor/mapEditorSlice";

import { saveVertexSizeMultiplier } from "Features/mapEditor/services/editorSettingsLocalStorage";

import { Box, Card, Typography, IconButton, Tooltip } from "@mui/material";

// Reference (×1) is the current hardcoded vertex size (POINT_SIZE = 6 in
// NodePolylineStatic); the two larger options scale it up. boxSize is only the
// on-screen preview square inside each option button.
const VERTEX_SIZES = [
  { multiplier: 1, boxSize: 6 },
  { multiplier: 1.5, boxSize: 9 },
  { multiplier: 2, boxSize: 12 },
];

// Vertex handle size card — device-local preference (mapEditorSettings
// localStorage). Shared by the right-panel SETTINGS tool
// (SectionEditorSettings2d) and the Configuration dialog (PageEditor2d).
export default function SectionVertexSize() {
  const dispatch = useDispatch();

  // data

  const vertexSizeMultiplier = useSelector(
    (s) => s.mapEditor.vertexSizeMultiplier
  );

  // handlers

  function handleSelectVertexSize(multiplier) {
    dispatch(setVertexSizeMultiplier(multiplier));
    saveVertexSizeMultiplier(multiplier);
  }

  // render

  return (
    <Card variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Vertex
      </Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          py: 0.25,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Taille vertex
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          {VERTEX_SIZES.map(({ multiplier, boxSize }) => {
            const isSelected = vertexSizeMultiplier === multiplier;
            return (
              <Tooltip key={multiplier} title={`×${multiplier}`}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => handleSelectVertexSize(multiplier)}
                  >
                    <Box
                      sx={{
                        width: boxSize,
                        height: boxSize,
                        border: "2px solid",
                        borderColor: isSelected
                          ? "primary.main"
                          : "text.secondary",
                        bgcolor: isSelected ? "primary.main" : "transparent",
                        borderRadius: 0.5,
                      }}
                    />
                  </IconButton>
                </span>
              </Tooltip>
            );
          })}
        </Box>
      </Box>
    </Card>
  );
}
