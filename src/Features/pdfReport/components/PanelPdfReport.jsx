import { useState } from "react";
import { useDispatch } from "react-redux";

import {
  setBgImageKeyInMapEditor,
  setShowBgImageInMapEditor,
  setBgImageRawTextAnnotations,
} from "Features/bgImage/bgImageSlice";

import useBgImageFormItem from "Features/bgImage/hooks/useBgImageFormItem";
import useBgImageFormTemplate from "Features/bgImage/hooks/useBgImageFormTemplate";
import useDownladPdfReport from "../hooks/useDownladPdfReport";
import usePdfReportName from "../hooks/usePdfReportName";

import { PictureAsPdf } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FormGenericV2 from "Features/form/components/FormGenericV2";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

import editor from "App/editor";

export default function PanelPdfReport() {
  const dispatch = useDispatch();

  // data

  const template = useBgImageFormTemplate();
  const item = useBgImageFormItem();
  const title = usePdfReportName();

  // data - func

  const exportPdf = useDownladPdfReport();

  // loading

  const [loading, setLoading] = useState(false);

  // handler

  function handleItemChange(item) {
    console.log("handleItemChange", item);
    dispatch(setShowBgImageInMapEditor(item.show));
    dispatch(setBgImageKeyInMapEditor(item.imageKey));

    // bgImageRawTextAnnotations
    const raw = item.metadata.reduce((acc, cur) => {
      if (cur.value) acc[cur.key] = cur.value;
      return acc;
    }, {});
    dispatch(setBgImageRawTextAnnotations(raw));
  }

  async function handleGenerateClick() {
    setLoading(true);
    console.log("handleGenerateClick");
    await exportPdf({
      svgElement: editor.mapEditorSvgElement,
      name: title,
      addTable: true,
    });
    setLoading(false);
  }

  // render

  return (
    <BoxFlexVStretch>
      <BoxFlexVStretch>
        <FormGenericV2
          template={template}
          item={item}
          onItemChange={handleItemChange}
        />
      </BoxFlexVStretch>
      <ButtonInPanelV2
        startIcon={<PictureAsPdf />}
        label="Télécharger"
        onClick={handleGenerateClick}
        variant="contained"
        color="secondary"
        loading={loading}
      />
    </BoxFlexVStretch>
  );
}
