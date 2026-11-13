import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  selectImagesCount,
  selectImagesPhotosHidden,
  setImagesPhotosHidden,
} from "../popperImagesSlice";

import { Box, Divider, Typography } from "@mui/material";
import Timeline from "@mui/icons-material/Timeline";
import LooksOne from "@mui/icons-material/LooksOne";
import MoreHoriz from "@mui/icons-material/MoreHoriz";

import ButtonBaseMapsGrid from "Features/baseMapsGrid/components/ButtonBaseMapsGrid";
import ButtonCountPill from "Features/popperMapListings/components/ButtonCountPill";
import SelectorImagesDisplayMode from "./SelectorImagesDisplayMode";
import DialogImagesDisplayOptions from "./DialogImagesDisplayOptions";

import useImagesDisplaySettings from "../hooks/useImagesDisplaySettings";
import {
  selectCaptureFramingActive,
  selectEffectiveViewerKey,
} from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// ---------------------------------------------------------------------------
// SectionImagesBottomBarControls — bottom bar controls of the photos (IMAGE
// annotations) of the displayed editor, left of the base maps controls:
// "Photos" + count pill (toggles the photos off everywhere), the display
// mode (in situ / overlay / print zones), the two tile ↔ anchor links as
// toggle buttons ("Ligne", "Numéro" — they only apply off in situ) and "…"
// (DialogImagesDisplayOptions). Shown for the 2D map editors and the 3D
// editor when the editor displays photos (popperImages.imagesCount, published
// by the editors); nothing under a capture / POV framing. Flat buttons, like
// SectionBaseMapsBottomBarControls.
// ---------------------------------------------------------------------------

export default function SectionImagesBottomBarControls() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Photos";
  const hidePhotosS = "Masquer les photos";
  const showPhotosS = "Afficher les photos";
  const lineS = "Ligne entre la photo et son point d'ancrage";
  const numberS = "Numéro sur la photo et sur son point d'ancrage";
  const moreS = "Options d'affichage des photos";

  // data

  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  const captureFramingActive = useSelector(selectCaptureFramingActive);
  const imagesCount = useSelector(selectImagesCount);
  const photosHidden = useSelector(selectImagesPhotosHidden);
  const { displayMode, linkLine, linkNumber, setLinkLine, setLinkNumber } =
    useImagesDisplaySettings();

  // state

  const [optionsOpen, setOptionsOpen] = useState(false);

  // helpers

  const is2dEditor =
    effectiveViewerKey === "MAP" || effectiveViewerKey === "BASE_MAPS";
  const is3dEditor = isThreedFamilyViewerKey(effectiveViewerKey) && !disable3D;
  const isMeshesViewer = viewerKey === "MESHES";
  const linksDisabled = displayMode === "IN_SITU";

  // render

  if (
    (!is2dEditor && !is3dEditor) ||
    isMeshesViewer ||
    captureFramingActive ||
    !imagesCount
  ) {
    return null;
  }

  return (
    <Box
      data-capture-hide
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 0.5,
        "& > .MuiPaper-root": {
          boxShadow: "none",
          border: "1px solid",
          borderColor: "divider",
        },
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, color: "text.secondary" }}
      >
        {titleS}
      </Typography>
      <ButtonCountPill
        count={imagesCount}
        hidden={photosHidden}
        title={photosHidden ? showPhotosS : hidePhotosS}
        onClick={() => dispatch(setImagesPhotosHidden(!photosHidden))}
      />
      <SelectorImagesDisplayMode />
      <ButtonBaseMapsGrid
        title={lineS}
        icon={<Timeline />}
        active={linkLine && !linksDisabled}
        disabled={linksDisabled}
        onClick={() => setLinkLine(!linkLine)}
      />
      <ButtonBaseMapsGrid
        title={numberS}
        icon={<LooksOne />}
        active={linkNumber && !linksDisabled}
        disabled={linksDisabled}
        onClick={() => setLinkNumber(!linkNumber)}
      />
      <ButtonBaseMapsGrid
        title={moreS}
        icon={<MoreHoriz />}
        onClick={() => setOptionsOpen(true)}
      />
      <Divider orientation="vertical" flexItem sx={{ my: 0.75 }} />

      {optionsOpen && (
        <DialogImagesDisplayOptions
          open
          onClose={() => setOptionsOpen(false)}
        />
      )}
    </Box>
  );
}
