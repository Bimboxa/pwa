import imageMap from "../assets/imageMap.png";

import { useState, useEffect } from "react";
import { nanoid } from "@reduxjs/toolkit";

import { useDispatch } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";

import db from "App/db/db";

import { Box, Typography, TextField, Button } from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import testIsImage from "Features/files/utils/testIsImage";

import FilesSelectorButton from "Features/files/components/FilesSelectorButton";
import SelectorImage from "Features/images/components/SelectorImage";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import a3_1_50 from "App/assets/a3_1_50.png";
import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import ImageGeneric from "Features/images/components/ImageGeneric";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";

export default function SectionCreateBaseMapFullscreen({ onClose, showClose, onCreated, listing: listingProp }) {
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
    const listing = listingProp ?? projectBaseMapListings?.[0];

    if (listing) {
      const entity = {
        name,
        image: { file },
        meterByPx,
      };
      const _entity = await createEntity(entity, { listing });

      // Post-process: set up version system with initial version
      if (_entity?.id) {
        const record = await db.baseMaps.get(_entity.id);
        if (record?.image?.imageSize) {
          await db.baseMaps.update(_entity.id, {
            refWidth: record.image.imageSize.width,
            refHeight: record.image.imageSize.height,
          });
          await db.baseMapVersions.put({
            id: nanoid(),
            baseMapId: _entity.id,
            projectId: record.projectId,
            listingId: record.listingId,
            label: "Image d'origine",
            fractionalIndex: "a0",
            isActive: true,
            image: record.image,
            transform: { x: 0, y: 0, rotation: 0, scale: 1 },
          });
        }
      }

      dispatch(setSelectedMainBaseMapId(_entity?.id));

      // clean
      setImageFile(null);
      setName("");
      setMeterByPx(null);

      // notify parent (portfolio editor)
      onCreated?.(_entity);
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
    if (onClose) onClose();
  }

  async function handleCreateDefault() {
    const file = await imageUrlToPng({ url: a3_1_50, name: "A3 - 1:50.png" });
    setImageFile(file);
    setMeterByPx(0.011975);
  }

  function handleOpenPageGmap() {
    const url = `${window.location.origin}/gmap`;
    window.open(url, "_blank", "noopener");
  }

  return (
    <>
      <BoxCenter
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          position: "relative",
        }}
      >
        {showClose && <Box
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
        </Box>}



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
            bgColor="white"
            selectedImageUrl={selectedImageUrl}
            onImageFileChange={handleImageFileChange}
            variant="BASE_MAP_CREATOR"
          />
        </Box>

        <Box sx={{ p: 1, width: 1, display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={handleOpenPageGmap} variant="outlined" size="small">Ouvrir Google Maps</Button>
        </Box>

      </BoxCenter>

      <DialogGeneric width={400} open={imageFile} onClose={() => setImageFile(null)}>
        <Box sx={{ p: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
        <ImageGeneric url={selectedImageUrl} />

      </DialogGeneric>
    </>
  );
}
