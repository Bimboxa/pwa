import IconFloorPlan from "../assets/IconFloorPlan";

import { useState, useEffect } from "react";
import { useSelector } from "react-redux";

import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useCreateBaseMapFromImage from "Features/baseMaps/hooks/useCreateBaseMapFromImage";
import useListingById from "Features/listings/hooks/useListingById";

import { Box, Typography, TextField, Button } from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import testIsImage from "Features/files/utils/testIsImage";

import FilesSelectorButton from "Features/files/components/FilesSelectorButton";
import SelectorImage from "Features/images/components/SelectorImage";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import ButtonOpenSatelliteMapDialog from "Features/satelliteMap/components/ButtonOpenSatelliteMapDialog";
import DialogCreateBlankBaseMap from "Features/baseMaps/components/DialogCreateBlankBaseMap";
import { InsertDriveFileOutlined as PageIcon } from "@mui/icons-material";

import a3_1_50 from "App/assets/a3_1_50.png";
import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import ImageGeneric from "Features/images/components/ImageGeneric";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";

export default function SectionCreateBaseMapFullscreen({ onClose, showClose, onCreated, listing: listingProp }) {

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
  const [openBlank, setOpenBlank] = useState(false);

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
  const createBaseMapFromImage = useCreateBaseMapFromImage();

  // the listing selected in the topBar baseMap selector chips
  const selectedBaseMapsListingId = useSelector(
    (s) => s.mapEditor.selectedBaseMapsListingId
  );
  const selectedBaseMapsListing = useListingById(selectedBaseMapsListingId);

  // resolved target listing for the new baseMap
  const listing =
    listingProp ?? selectedBaseMapsListing ?? projectBaseMapListings?.[0];

  // helpers

  const selectedImageUrl = imageFile ? URL.createObjectURL(imageFile) : null;

  async function _createBaseMap(file) {
    if (!listing) return;

    const _entity = await createBaseMapFromImage({
      file,
      name,
      listing,
      meterByPx,
    });

    // clean
    setImageFile(null);
    setName("");
    setMeterByPx(null);

    // notify parent (portfolio editor)
    onCreated?.(_entity);
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
            BgIcon={IconFloorPlan}
            selectedImageUrl={selectedImageUrl}
            onImageFileChange={handleImageFileChange}
            variant="BASE_MAP_CREATOR"
          />
        </Box>

        <Box
          sx={{
            width: 1,
            display: "flex",
            justifyContent: "flex-end",
            gap: 1,
            px: 4,
            pb: 2,
          }}
        >
          <Button
            onClick={() => setOpenBlank(true)}
            variant="outlined"
            color="inherit"
            size="small"
            startIcon={<PageIcon />}
          >
            Ajouter une page blanche
          </Button>
          <ButtonOpenSatelliteMapDialog
            listing={listing}
            onCreated={onCreated}
            onClose={onClose}
          />
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

      <DialogCreateBlankBaseMap
        open={openBlank}
        onClose={() => setOpenBlank(false)}
        listing={listing}
        onCreated={(entity) => {
          onCreated?.(entity);
          if (onClose) onClose();
        }}
      />
    </>
  );
}
