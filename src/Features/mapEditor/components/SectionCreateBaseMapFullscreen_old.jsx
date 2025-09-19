import imageMap from "../assets/imageMap.png";

import { useState } from "react";

import { useDispatch } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import useCreateBaseMap from "Features/baseMaps/hooks/useCreateBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";

import { Box, Typography } from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";
import testIsImage from "Features/files/utils/testIsImage";

import FilesSelectorButton from "Features/files/components/FilesSelectorButton";

export default function SectionCreateBaseMapFullscreen() {
  const dispatch = useDispatch();

  // strings

  const dragS = "Glissez déposez une image / PDF / photo";
  const selectFileS = "Choisir un fichier";
  const nameS = "Plan 01";

  // state

  const [dragging, setDragging] = useState(false);

  // data

  const createBaseMap = useCreateBaseMap();
  const projectBaseMapListings = useProjectBaseMapListings();
  const createEntity = useCreateEntity();

  // helpers

  async function _createBaseMap(file) {
    const listing = projectBaseMapListings?.[0];

    const entity = {
      name: file.name,
      image: { imageFile: file },
    };
    await createEntity(entity, { listing });

    //const baseMap = await createBaseMap({ imageFile: file });
    //const baseMapView = await createBaseMapView({ name: nameS, baseMap });
    dispatch(setSelectedMainBaseMapId(baseMap?.id));
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
        await _createBaseMap(firstFile);
      }
      // You can now use firstFile as needed, e.g., read it with FileReader
      console.log("First dragged file:", firstFile);
    }
  }

  async function handleFilesChangeFromButton(files) {
    const firstFile = files[0];
    if (testIsImage(firstFile)) {
      await _createBaseMap(firstFile);
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
          <Typography color={"secondary"} noWrap>
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
