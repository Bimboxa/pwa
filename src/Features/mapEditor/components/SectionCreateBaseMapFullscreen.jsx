import imageMap from "../assets/imageMap.png";

import { useState, useEffect } from "react";

import { useDispatch } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import useCreateBaseMap from "Features/baseMaps/hooks/useCreateBaseMap";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";

import { Box, Typography, TextField } from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";
import testIsImage from "Features/files/utils/testIsImage";

import FilesSelectorButton from "Features/files/components/FilesSelectorButton";
import SelectorImage from "Features/images/components/SelectorImage";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import a3_1_50 from "App/assets/a3_1_50.png";
import imageUrlToPng from "Features/images/utils/imageUrlToPng";

export default function SectionCreateBaseMapFullscreen({ onClose }) {
  const dispatch = useDispatch();

  // strings

  const dragS = "Glissez déposez une image / PDF / photo";
  const selectFileS = "Choisir un fichier";
  const placeholder = "Nom du fond de plan";
  const createS = "Créer le fond de plan";
  const defaultS = "Page blanche A3 1:50";

  // state

  const [dragging, setDragging] = useState(false);

  const [imageFile, setImageFile] = useState(null);
  const [name, setName] = useState("");
  const [meterByPx, setMeterByPx] = useState(null);

  // effect

  useEffect(() => {
    if (imageFile && !name) {
      const fileName = imageFile.name;
      const lastDotIndex = fileName.lastIndexOf(".");
      const nameWithoutExtension =
        lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
      setName(nameWithoutExtension);
    }
  }, [imageFile]);

  // data

  const projectBaseMapListings = useProjectBaseMapListings();
  const createEntity = useCreateEntity();

  // helpers

  const selectedImageUrl = imageFile ? URL.createObjectURL(imageFile) : null;

  async function _createBaseMap(file) {
    const listing = projectBaseMapListings?.[0];
    console.log("baseMaps listing", listing, file);

    if (listing) {
      const entity = {
        name,
        image: { file },
        meterByPx,
      };
      const _entity = await createEntity(entity, { listing });

      //const baseMap = await createBaseMap({ imageFile: file });
      //const baseMapView = await createBaseMapView({ name: nameS, baseMap });
      dispatch(setSelectedMainBaseMapId(_entity?.id));
      if (onClose) onClose();
    }
  }

  // helpers

  const disabled = !(name.length > 0 && Boolean(imageFile));

  // handlers

  function handleImageFileChange(imageFile) {
    setImageFile(imageFile);
  }

  function handleNameChange(e) {
    setName(e.target.value);
  }

  async function handleCreateClick() {
    await _createBaseMap(imageFile);
  }

  async function handleCreateDefault() {
    const file = await imageUrlToPng({ url: a3_1_50, name: "A3 - 1:50.png" });
    setImageFile(file);
    setMeterByPx(0.011975);
  }

  return (
    <BoxCenter
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        position: "relative",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          p: 1,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <IconButtonClose onClose={onClose} />
      </Box>

      <Box sx={{ display: "flex", width: 1, justifyContent: "center", p: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <TextField
            //label={nameS}
            placeholder={placeholder}
            value={name}
            onChange={handleNameChange}
            size="small"
            sx={{ mr: 2 }}
          />
          <ButtonGeneric
            label={createS}
            onClick={handleCreateClick}
            variant="contained"
            color="secondary"
            disabled={disabled}
          />
        </Box>
      </Box>

      <ButtonGeneric onClick={handleCreateDefault} label={defaultS} />

      <Box
        sx={{
          width: 1,
          minHeight: 0,
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          p: 4,
        }}
      >
        <SelectorImage
          bgImageUrl={imageMap}
          selectedImageUrl={selectedImageUrl}
          onImageFileChange={handleImageFileChange}
        />
      </Box>
    </BoxCenter>
  );
}
