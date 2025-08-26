import imageMap from "../assets/imageMap.png";

import { useState } from "react";

import { useDispatch } from "react-redux";

import {
  setBaseMapViewsById,
  setSelectedBaseMapViewId,
} from "Features/baseMapViews/baseMapViewsSlice";

import useCreateBaseMap from "Features/baseMaps/hooks/useCreateBaseMap";
import useCreateBaseMapView from "Features/baseMapViews/hooks/useCreateBaseMapView";

import { Box, Typography } from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";
import testIsImage from "Features/files/utils/testIsImage";

import FilesSelectorButton from "Features/files/components/FilesSelectorButton";

export default function SectionNoMap() {
  const dispatch = useDispatch();

  // strings

  const dragS = "Glissez déposez un plan";
  const selectFileS = "Choisir un fichier";
  const nameS = "Plan 01";

  // state

  const [dragging, setDragging] = useState(false);

  // data

  const createBaseMap = useCreateBaseMap();
  const createBaseMapView = useCreateBaseMapView();

  // helpers

  async function _createBaseMapView(file) {
    const baseMap = await createBaseMap({ imageFile: file });
    const baseMapView = await createBaseMapView({ name: nameS, baseMap });

    dispatch(setBaseMapViewsById(baseMapView?.id));
  }

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
        await _createBaseMapView(firstFile);
      }
      // You can now use firstFile as needed, e.g., read it with FileReader
      console.log("First dragged file:", firstFile);
    }
  }

  async function handleFilesChangeFromButton(files) {
    const firstFile = files[0];
    if (testIsImage(firstFile)) {
      await _createBaseMapView(firstFile);
    }
  }

  return (
    <BoxCenter sx={{ p: "120px" }}>
      <Box
        sx={{
          border: (theme) =>
            `2px dashed ${
              dragging ? theme.palette.secondary.main : theme.palette.divider
            }`,

          width: 1,
          height: 1,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Box
          sx={{
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            flexDirection: "column",
          }}
          position="absolute"
        >
          <Typography color={dragging ? "secondary" : "text.secondary"}>
            {dragS}
          </Typography>
          <FilesSelectorButton
            onFilesChange={handleFilesChangeFromButton}
            buttonName={selectFileS}
            //startIcon="computer"
            buttonVariant="inline"
            buttonColor="text.secondary"
            multiple={false}
            accept=".png"
          />
        </Box>
        <img
          src={imageMap}
          height="100%"
          alt="Aucune carte disponible"
          //style={{ border: "1px solid red" }}
          onMouseDown={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          draggable={false}
        />
      </Box>
    </BoxCenter>
  );
}
