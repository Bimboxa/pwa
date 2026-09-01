import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedBaseMapsListingId } from "../mapEditorSlice";
import {
  setOpenBaseMapCreator,
  setPdfFile,
} from "Features/baseMapCreator/baseMapCreatorSlice";
import { setToaster } from "Features/layout/layoutSlice";

import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useCreateBaseMapFromImage from "Features/baseMaps/hooks/useCreateBaseMapFromImage";

import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Divider,
} from "@mui/material";
import { CropLandscape as LandscapeIcon } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import ImageGeneric from "Features/images/components/ImageGeneric";
import ContainerFilesSelectorV2 from "Features/files/components/ContainerFilesSelectorV2";
import SelectorBaseMapListingChipsRow from "Features/baseMaps/components/SelectorBaseMapListingChipsRow";
import CardCreateBaseMapOption from "Features/baseMaps/components/CardCreateBaseMapOption";
import {
  IllustrationDwg,
  IllustrationPdf,
  IllustrationImage,
  IllustrationBlankPage,
  IllustrationSatellite,
} from "Features/baseMaps/components/IllustrationsCreateBaseMap";
import DialogCreateBlankBaseMap from "Features/baseMaps/components/DialogCreateBlankBaseMap";
import DialogCreateBaseMapFromSatellite from "Features/satelliteMap/components/DialogCreateBaseMapFromSatellite";

import testIsPdf from "Features/pdf/utils/testIsPdf";
import testIsImage from "Features/files/utils/testIsImage";
import testIsDwg from "Features/files/utils/testIsDwg";
import createBlankImageFile from "Features/images/utils/createBlankImageFile";
import getBlankBaseMapGeometry from "Features/baseMaps/utils/getBlankBaseMapGeometry";

export default function SectionCreateBaseMapFullscreen({
  onClose,
  showClose,
  onCreated,
  listing: listingProp,
}) {
  const dispatch = useDispatch();

  // strings

  const dropTitleS = "Glisser-déposer un plan ici";
  const dropSubtitleS = "PDF · DWG · JPG · PNG — le format est reconnu automatiquement";
  const storeInS = "Ranger dans";
  const orCreateFromS = "OU CRÉER DEPUIS";

  const namePlaceholderS = "Nom du fond de plan";
  const createS = "Créer le fond de plan";

  const dwgTitleS = "Fichier DWG";
  const dwgSubtitleS = "Calques et échelle conservés";
  const pdfTitleS = "PDF";
  const pdfSubtitleS = "Choix de la page et cadrage";
  const imageTitleS = "Image";
  const imageSubtitleS = "JPG, PNG ou capture";
  const blankTitleS = "Page blanche";
  const blankSubtitleS = "Format à l'échelle";
  const satelliteTitleS = "Image satellite";
  const satelliteSubtitleS = "Extrait géoréférencé";

  const computerS = "Ordinateur";
  const a3S = "A3";
  const otherS = "Autre…";
  const chooseZoneS = "Choisir une zone";
  const soonS = "Prochainement";

  const dwgSoonS = "Le format DWG arrive prochainement";
  const unsupportedS = "Format non pris en charge";
  const noListingS = "Aucune liste de fonds de plan";
  const blankA3NameS = "Page blanche A3";

  // refs

  const pdfInputRef = useRef();
  const imageInputRef = useRef();
  const syncedListingPropRef = useRef(false);

  // state

  const [imageFile, setImageFile] = useState(null);
  const [name, setName] = useState("");
  const [openBlank, setOpenBlank] = useState(false);
  const [openSatellite, setOpenSatellite] = useState(false);

  // data

  const listings = useProjectBaseMapListings({ excludeDisabled: true });
  const createBaseMapFromImage = useCreateBaseMapFromImage();

  const selectedBaseMapsListingId = useSelector(
    (s) => s.mapEditor.selectedBaseMapsListingId
  );

  // helpers

  // resolved target listing for the new baseMap
  const listing =
    listings?.find((l) => l.id === selectedBaseMapsListingId) ??
    listingProp ??
    listings?.[0];

  const selectedImageUrl = imageFile ? URL.createObjectURL(imageFile) : null;

  const createDisabled = !(name.length > 0 && Boolean(imageFile));

  async function _createBaseMap(file) {
    if (!listing) {
      dispatch(setToaster({ message: noListingS, isError: true }));
      return;
    }

    const _entity = await createBaseMapFromImage({
      file,
      name,
      listing,
      meterByPx: null,
    });

    // clean
    setImageFile(null);
    setName("");

    // notify parent (portfolio editor)
    onCreated?.(_entity);
  }

  // effects

  useEffect(() => {
    if (imageFile && !name) {
      const fileName = imageFile.name;
      const lastDotIndex = fileName.lastIndexOf(".");
      const nameWithoutExtension =
        lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
      setName(nameWithoutExtension);
    }
  }, [imageFile]);

  // Keep the global selection (topBar chips + PDF creator, which both read
  // s.mapEditor.selectedBaseMapsListingId) aligned with the panel's target
  // listing: one-shot sync on the explicit listing prop, then heal a
  // null/stale global selection.
  useEffect(() => {
    if (!syncedListingPropRef.current && listingProp?.id) {
      syncedListingPropRef.current = true;
      if (listingProp.id !== selectedBaseMapsListingId) {
        dispatch(setSelectedBaseMapsListingId(listingProp.id));
      }
      return;
    }
    if (listing?.id && listing.id !== selectedBaseMapsListingId) {
      dispatch(setSelectedBaseMapsListingId(listing.id));
    }
  }, [listingProp?.id, listing?.id, selectedBaseMapsListingId]);

  // handlers

  function handlePdfFile(file) {
    // ButtonCreateBaseMaps closes the section itself once the baseMaps are
    // created, so don't call onClose here.
    dispatch(setPdfFile(file));
    dispatch(setOpenBaseMapCreator(true));
  }

  function handleImageFile(file) {
    setImageFile(file);
  }

  function handleDropZoneFiles(files) {
    const file = files?.[0];
    if (!file) return;
    if (testIsPdf(file)) {
      handlePdfFile(file);
    } else if (testIsImage(file)) {
      handleImageFile(file);
    } else if (testIsDwg(file)) {
      dispatch(setToaster({ message: dwgSoonS, severity: "info" }));
    } else {
      dispatch(setToaster({ message: unsupportedS, severity: "warning" }));
    }
  }

  function handlePdfInputChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handlePdfFile(file);
  }

  function handleImageInputChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleImageFile(file);
  }

  function handleListingSelect(listingId) {
    dispatch(setSelectedBaseMapsListingId(listingId));
  }

  async function handleCreateBlankA3() {
    if (!listing) {
      dispatch(setToaster({ message: noListingS, isError: true }));
      return;
    }

    const { pixelWidth, pixelHeight, meterByPx } = getBlankBaseMapGeometry({
      format: "paysage",
      size: "A3",
      scale: 50,
    });

    const file = await createBlankImageFile({
      width: pixelWidth,
      height: pixelHeight,
      fileName: `${blankA3NameS}.png`,
    });

    const entity = await createBaseMapFromImage({
      file,
      name: blankA3NameS,
      listing,
      meterByPx,
      orientation: "HORIZONTAL",
    });

    onCreated?.(entity);
    onClose?.();
  }

  function handleNameChange(e) {
    setName(e.target.value);
  }

  async function handleCreateClick() {
    await _createBaseMap(imageFile);
    if (onClose) onClose();
  }

  function handleSatelliteCreated(entity) {
    setOpenSatellite(false);
    onCreated?.(entity);
    onClose?.();
  }

  // render

  return (
    <>
      <Box
        sx={{
          width: 1,
          height: 1,
          position: "relative",
          bgcolor: "background.default",
          backgroundImage:
            "radial-gradient(circle, rgba(120,120,140,0.18) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        {showClose && (
          <Box sx={{ position: "absolute", top: 0, right: 0, p: 1, zIndex: 2 }}>
            <IconButtonClose onClose={onClose} />
          </Box>
        )}

        <Box
          sx={{
            width: 1,
            height: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              m: "auto",
              width: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2.5,
              py: 5,
              px: 2,
            }}
          >
            {/* Main drop zone */}

            <Paper
              elevation={3}
              sx={{ width: 1, maxWidth: 560, borderRadius: "12px", p: 2 }}
            >
              <ContainerFilesSelectorV2
                callToActionLabel={dropTitleS}
                subLabel={dropSubtitleS}
                accept=".png,.jpg,.jpeg,.pdf,.dwg"
                onFilesChange={handleDropZoneFiles}
                sxDropZone={{
                  minHeight: 220,
                  borderColor: (theme) =>
                    alpha(theme.palette.secondary.main, 0.5),
                }}
              />
            </Paper>

            {/* Destination listing */}

            {listings?.length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  gap: 1,
                  px: 2,
                }}
              >
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {storeInS}
                </Typography>
                <SelectorBaseMapListingChipsRow
                  listings={listings}
                  selectedListingId={listing?.id}
                  onSelect={handleListingSelect}
                />
              </Box>
            )}

            {/* Other creation options */}

            <Divider sx={{ width: 1, maxWidth: 720, my: 1 }}>
              <Typography
                variant="overline"
                sx={{ color: "text.disabled", letterSpacing: 1 }}
              >
                {orCreateFromS}
              </Typography>
            </Divider>

            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 3,
                maxWidth: 1000,
              }}
            >
              <CardCreateBaseMapOption
                title={dwgTitleS}
                subtitle={dwgSubtitleS}
                illustration={<IllustrationDwg />}
                badge={soonS}
                disabled
                actions={
                  <Button variant="outlined" color="inherit" size="small" disabled>
                    {computerS}
                  </Button>
                }
              />
              <CardCreateBaseMapOption
                title={pdfTitleS}
                subtitle={pdfSubtitleS}
                illustration={<IllustrationPdf />}
                actions={
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={() => pdfInputRef.current?.click()}
                  >
                    {computerS}
                  </Button>
                }
              />
              <CardCreateBaseMapOption
                title={imageTitleS}
                subtitle={imageSubtitleS}
                illustration={<IllustrationImage />}
                actions={
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    {computerS}
                  </Button>
                }
              />
              <CardCreateBaseMapOption
                title={blankTitleS}
                subtitle={blankSubtitleS}
                illustration={<IllustrationBlankPage />}
                actions={
                  <>
                    <Button
                      variant="outlined"
                      color="inherit"
                      size="small"
                      startIcon={<LandscapeIcon />}
                      onClick={handleCreateBlankA3}
                    >
                      {a3S}
                    </Button>
                    <Button
                      variant="outlined"
                      color="inherit"
                      size="small"
                      onClick={() => setOpenBlank(true)}
                    >
                      {otherS}
                    </Button>
                  </>
                }
              />
              <CardCreateBaseMapOption
                title={satelliteTitleS}
                subtitle={satelliteSubtitleS}
                illustration={<IllustrationSatellite />}
                actions={
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={() => setOpenSatellite(true)}
                  >
                    {chooseZoneS}
                  </Button>
                }
              />
            </Box>
          </Box>
        </Box>

        {/* Hidden per-card file inputs */}

        <input
          ref={pdfInputRef}
          type="file"
          accept=".pdf"
          style={{ display: "none" }}
          onChange={handlePdfInputChange}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept=".png,.jpg,.jpeg"
          style={{ display: "none" }}
          onChange={handleImageInputChange}
        />
      </Box>

      {/* Naming dialog (image flow) */}

      <DialogGeneric
        width={400}
        open={Boolean(imageFile)}
        onClose={() => setImageFile(null)}
      >
        <Box
          sx={{
            p: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TextField
            placeholder={namePlaceholderS}
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
            disabled={createDisabled}
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

      <DialogCreateBaseMapFromSatellite
        open={openSatellite}
        onClose={() => setOpenSatellite(false)}
        listing={listing}
        onCreated={handleSatelliteCreated}
      />
    </>
  );
}
