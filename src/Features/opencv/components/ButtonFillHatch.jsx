import { useState } from "react";
import { useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setOpencvClickMode } from "../opencvSlice";

import { Box } from "@mui/material";
import ButtonActionInPanel from "Features/layout/components/ButtonActionInPanel";

export default function ButtonFillHatch() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  const label = "Remplir les hachures";

  async function handleClick() {
    dispatch(setEnabledDrawingMode("OPENCV"));
    dispatch(setOpencvClickMode("FILL_HATCH"));
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <ButtonActionInPanel
        label={label}
        onClick={handleClick}
        loading={loading}
        variant="contained"
        color="action"
      />
    </Box>
  );
}
