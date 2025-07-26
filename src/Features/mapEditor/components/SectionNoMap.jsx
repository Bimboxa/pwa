import imageMap from "../assets/imageMap.png";

import { useState } from "react";

import { Box } from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";
import testIsImage from "Features/files/utils/testIsImage";
import useCreateBaseMap from "Features/baseMaps/hooks/useCreateBaseMap";

export default function SectionNoMap() {
  // state

  const [dragging, setDragging] = useState(false);

  // data

  const createBaseMap = useCreateBaseMap();

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

  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log("debug_1607", e.dataTransfer.files);
    setDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      if (testIsImage(firstFile)) {
        await createBaseMap({ imageFile: firstFile });
      }
      // You can now use firstFile as needed, e.g., read it with FileReader
      console.log("First dragged file:", firstFile);
    }
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
