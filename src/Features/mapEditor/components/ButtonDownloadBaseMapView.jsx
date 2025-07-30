import { useSelector } from "react-redux";

import { IconButton, Tooltip } from "@mui/material";
import { Download } from "@mui/icons-material";

import editor from "App/editor";
import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import downloadBlob from "Features/files/utils/downloadBlob";
import imageToPdfAsync from "Features/pdf/utils/imageToPdfAsync";
import useSelectedBaseMapViewInEditor from "Features/baseMapViews/hooks/useSelectedBaseMapViewInEditor";

export default function ButtonDownloadBaseMapView() {
  // strings

  const title = "Télécharger";

  // data

  const printModeEnabled = useSelector((s) => s.mapEditor.printModeEnabled);
  const baseMapView = useSelectedBaseMapViewInEditor();

  // handler

  async function handleClick() {
    //editor.mapEditor.refresh();
    const url = editor.mapEditor.getStageImageUrl();
    const size = editor.mapEditor.stage.size();
    console.log("size", size);
    //
    let file;
    if (printModeEnabled) {
      file = await imageToPdfAsync({
        url,
        width: size.width,
        height: size.height,
      });
    } else {
      file = await imageUrlToPng({ url });
    }
    console.log("file", file);
    downloadBlob(file, baseMapView.name);
  }

  return (
    <Tooltip title={title}>
      <IconButton onClick={handleClick} color="inherit">
        <Download />
      </IconButton>
    </Tooltip>
  );
}
