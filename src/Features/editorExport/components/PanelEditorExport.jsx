import { useState } from "react";

import { Box } from "@mui/material";

import RadioButtonGeneric from "Features/layout/components/RadioButtonGeneric";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

import editor from "App/editor";

import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import downloadBlob from "Features/files/utils/downloadBlob";
import imageToPdfAsync from "Features/pdf/utils/imageToPdfAsync";

export default function PanelEditorExport() {
  // strings

  const title = "Export";
  const buttonLabel = "Exporter";

  // const

  const options = [
    {
      key: "PNG",
      label: "PNG",
    },
    {
      key: "PDF",
      label: "PDF",
    },
  ];

  // state

  const [exportType, setExportType] = useState("PNG");

  // handlers

  async function handleClick() {
    const url = editor.mapEditor.getStageImageUrl();
    const size = editor.mapEditor.stage.size();
    console.log("size", size);
    //
    let file;
    if (exportType === "PDF") {
      file = await imageToPdfAsync({
        url,
        width: size.width,
        height: size.height,
      });
    } else {
      file = await imageUrlToPng({ url });
    }
    downloadBlob(file, "export");
  }

  // render

  return (
    <Box>
      <RadioButtonGeneric
        row={true}
        label={title}
        options={options}
        value={exportType}
        onChange={setExportType}
      />
      <ButtonInPanelV2
        label={buttonLabel}
        onClick={handleClick}
        variant="contained"
      />
    </Box>
  );
}
