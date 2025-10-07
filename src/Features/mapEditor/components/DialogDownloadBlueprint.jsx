import { useState, useEffect } from "react";

import { useSelector } from "react-redux";

import useSelectedEntity from "Features/entities/hooks/useSelectedEntity";
import useAnnotations from "Features/annotations/hooks/useAnnotations";
import useMainBaseMap from "../hooks/useMainBaseMap";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

import { Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SwitchGeneric from "Features/layout/components/SwitchGeneric";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import FieldTextV2 from "Features/form/components/FieldTextV2";

import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";
import imageToPdfAsync from "Features/pdf/utils/imageToPdfAsync";
import mergePdfs from "Features/pdf/utils/mergePdfs";
import downloadBlob from "Features/files/utils/downloadBlob";

import createAnnotationsPdfReport from "Features/pdfReport/utils/createAnnotationsPdfReport";

export default function DialogDownloadBlueprint({ svgElement, open, onClose }) {
  // strings

  const downloadS = "Télécharger";
  const messageS = "Télécharger le rapport au format PDF";
  const addTableS = "Inclure le rapport photos";
  const nameLabel = "Nom du fichier";

  // data

  const { value: blueprint } = useSelectedEntity();
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
  const mainBaseMap = useMainBaseMap();
  const spriteImage = useAnnotationSpriteImage();

  const annotations = useAnnotations({
    addDemoAnnotations: false,
    filterByBaseMapId: mainBaseMap?.id,
    excludeListingsIds: hiddenListingsIds,
    withEntity: true,
    withLabel: true,
  });

  // state

  const [addTable, setAddTable] = useState(true);
  const [name, setName] = useState("");
  useEffect(() => {
    if (!name) {
      setName(blueprint?.name);
    }
  }, [blueprint?.name]);

  // handlers

  async function handleClick() {
    console.log("click");
    const blob = await getImageFromSvg(svgElement);
    const url = URL.createObjectURL(blob);
    const blueprintPdf = await imageToPdfAsync({ url });

    let finalPdf;

    if (addTable) {
      const issuesPdf = await createAnnotationsPdfReport(annotations, {
        spriteImage,
      });
      finalPdf = await mergePdfs([blueprintPdf, issuesPdf]);
    } else {
      // If no table is requested, just use the blueprint PDF
      finalPdf = blueprintPdf;
    }

    downloadBlob(finalPdf, name);
    onClose();
  }

  // render

  return (
    <DialogGeneric open={open} onClose={onClose} width={250}>
      <BoxFlexVStretch sx={{ p: 1 }}>
        <Typography sx={{ mb: 2 }}>{messageS}</Typography>
        <FieldTextV2 value={name} onChange={setName} label={nameLabel} />
        <SwitchGeneric
          label={addTableS}
          checked={addTable}
          onChange={setAddTable}
        />
        <ButtonGeneric
          sx={{ mt: 2 }}
          label={downloadS}
          onClick={handleClick}
          variant="contained"
          disabled={!name}
        />
      </BoxFlexVStretch>
    </DialogGeneric>
  );
}
