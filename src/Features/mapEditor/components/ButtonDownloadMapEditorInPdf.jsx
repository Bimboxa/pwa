import { useSelector } from "react-redux";

import { PictureAsPdf } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import imageToPdfAsync from "Features/pdf/utils/imageToPdfAsync";
import downloadBlob from "Features/files/utils/downloadBlob";
import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";

export default function ButtonDownloadMapEditorInPdf({ svgElement }) {
  // label

  const label = "Télécharger";

  // data

  const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);

  // handlers

  async function handleClick() {
    console.log("click");
    const blob = await getImageFromSvg(svgElement);
    const url = URL.createObjectURL(blob);
    const pdf = await imageToPdfAsync({ url });
    downloadBlob(pdf, "pdf");
  }

  // render

  if (!showBgImage) return null;

  return (
    <ButtonGeneric
      startIcon={<PictureAsPdf />}
      onClick={handleClick}
      label={label}
      color="secondary"
      variant="contained"
    />
  );
}
