import imageMap from "../assets/imageMap.png";

import { useState } from "react";

import { Box } from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";

export default function SectionNoMap() {
  // state

  const [dragging, setDragging] = useState(false);

  // handlers

  function handleDragEnter() {
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log("debug_1607", e.dataTransfer.files);
    setDragging(false);
  }

  return (
    <BoxCenter sx={{ p: 4 }}>
      <Box
        sx={{
          ...(dragging && { border: "1px solid red" }),
          width: 1,
          height: 1,
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <img src={imageMap} width="100%" alt="Aucune carte disponible" />
      </Box>
    </BoxCenter>
  );
}
