import { useState } from "react";
import { useSelector } from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useSelectedEntity from "Features/entities/hooks/useSelectedEntity";

import { PictureAsPdf } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import imageToPdfAsync from "Features/pdf/utils/imageToPdfAsync";
import downloadBlob from "Features/files/utils/downloadBlob";
import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";
import useMainBaseMap from "../hooks/useMainBaseMap";
import DialogDownloadBlueprint from "./DialogDownloadBlueprint";

export default function ButtonDownloadMapEditorInPdf({ svgElement }) {
  // label

  const label = "Télécharger";

  // data

  const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
  const baseMap = useMainBaseMap();
  const { value: listing } = useSelectedListing();
  const { value: selectedEntity } = useSelectedEntity();

  // state

  const [open, setOpen] = useState(false);

  // helpers

  const isOneBlueprintSelected =
    selectedEntity && selectedEntity?.listingId === listing?.id;

  // handlers

  async function handleClick() {
    console.log("click");
    const blob = await getImageFromSvg(svgElement);
    const url = URL.createObjectURL(blob);
    const pdf = await imageToPdfAsync({ url });
    downloadBlob(pdf, baseMap?.name ?? "plan");
  }

  // render

  if (
    !showBgImage ||
    listing?.entityModel?.type !== "BLUEPRINT" ||
    !isOneBlueprintSelected
  )
    return null;

  return (
    <>
      <ButtonGeneric
        startIcon={<PictureAsPdf />}
        onClick={() => setOpen(true)}
        label={label}
        color="secondary"
        variant="contained"
      />
      {open && (
        <DialogDownloadBlueprint
          open={open}
          onClose={() => setOpen(false)}
          svgElement={svgElement}
        />
      )}
    </>
  );
}
