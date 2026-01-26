import { useState } from "react";

import { Box } from "@mui/material";

import Panel from "Features/layout/components/Panel";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ViewerPdf from "./ViewerPdf";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import pdfToPngAsync from "../utils/pdfToPngAsync";

export default function PanelPdfConverter({
  onClose,
  pdfFile,
  onImageFileCreated,
}) {
  // strings

  const title = "Conversion du PDF en image";
  const convertS = "Convertir en image";

  // state

  const [loading, setLoading] = useState(false);

  // handlers

  async function handleConvert() {
    setLoading(true);
    const { imageFile } = await pdfToPngAsync({ pdfFile });
    if (onImageFileCreated) onImageFileCreated(imageFile);
    setLoading(false);
  }

  return (
    <Panel>
      {title && <HeaderTitleClose title={title} onClose={onClose} />}
      <BoxFlexVStretch>
        <Box sx={{ display: "flex", width: 1, flexGrow: 1 }}>
          <ViewerPdf pdfFile={pdfFile} />
        </Box>
        <ButtonInPanel
          label={convertS}
          onClick={handleConvert}
          loading={loading}
        />
      </BoxFlexVStretch>
    </Panel>
  );
}
