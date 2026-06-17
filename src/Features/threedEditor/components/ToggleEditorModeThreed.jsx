import { useDispatch, useSelector } from "react-redux";

import { setEditorMode } from "Features/threedEditor/threedEditorSlice";

import { Paper, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import ThreeDRotation from "@mui/icons-material/ThreeDRotation";
import HighlightAlt from "@mui/icons-material/HighlightAlt";

export default function ToggleEditorModeThreed() {
  const dispatch = useDispatch();

  const editorMode = useSelector((s) => s.threedEditor.editorMode);

  function handleChange(_event, value) {
    if (!value) return;
    dispatch(setEditorMode(value));
  }

  return (
    <Paper elevation={2} sx={{ borderRadius: "8px" }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={editorMode}
        onChange={handleChange}
        sx={{
          "& .MuiToggleButton-root": {
            border: "none",
            width: 30,
            height: 30,
            borderRadius: "8px",
          },
        }}
      >
        <Tooltip title="Navigation (shift + drag = caméra)">
          <ToggleButton value="NAVIGATION">
            <ThreeDRotation sx={{ fontSize: 18 }} />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Sélection (shift + drag = lasso)">
          <ToggleButton value="SELECTION">
            <HighlightAlt sx={{ fontSize: 18 }} />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
    </Paper>
  );
}
