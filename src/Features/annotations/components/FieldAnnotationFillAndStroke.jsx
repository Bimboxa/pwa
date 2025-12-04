
import { useState } from "react";

import { Box, IconButton, Menu } from "@mui/material";
import { Texture, Pentagon, Polyline } from "@mui/icons-material";

import AnnotationIcon from "Features/annotations/components/AnnotationIcon";
import FieldFill from "Features/form/components/FieldFill";
import FieldStroke from "Features/form/components/FieldStroke";

export default function FieldAnnotationFillAndStroke({ annotation, onChange }) {

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // helpers

  const { fillColor, fillType, fillOpacity, strokeColor, closeLine, strokeWidth, strokeWidthUnit, type } = annotation ?? {};

  // helpers 

  const fill = { fillColor, fillType, fillOpacity };
  const stroke = { strokeColor, strokeWidth, strokeWidthUnit, closeLine };

  // helper - show

  const showFill = type === "POLYGON";
  const showStroke = type === "POLYLINE";


  // handlers

  function handleClick(e) {
    setAnchorEl(e.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  // handlers - onChange

  function handleChangeFill(newFill) {
    onChange({ ...annotation, ...newFill });
  }

  function handleChangeStroke(newStroke) {
    onChange({ ...annotation, ...newStroke });
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <IconButton onClick={handleClick} sx={{ borderRadius: "50%" }}>
        <AnnotationIcon annotation={annotation} />
      </IconButton>
      <Menu open={open} anchorEl={anchorEl} onClose={handleClose} sx={{ p: 1 }}>
        <Box sx={{ p: 1 }}>
          {showFill && <FieldFill value={fill} onChange={handleChangeFill} />}
          {showStroke && <FieldStroke value={stroke} onChange={handleChangeStroke} />}
        </Box>

      </Menu>
    </Box>

  );
}
