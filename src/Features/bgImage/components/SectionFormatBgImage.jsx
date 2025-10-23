import { useDispatch } from "react-redux";

import { setBgImageKeyInMapEditor } from "../bgImageSlice";
import { setShowBgImageInMapEditor } from "../bgImageSlice";
import { setBgImageRawTextAnnotations } from "../bgImageSlice";

import useBgImageFormItem from "../hooks/useBgImageFormItem";
import useBgImageFormTemplate from "../hooks/useBgImageFormTemplate";

import { Box, Typography } from "@mui/material";
import theme from "Styles/theme";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import FormGenericV2 from "Features/form/components/FormGenericV2";
import PanelTitle from "Features/layout/components/PanelTitle";
import IconListingVariantBasic from "Features/listings/components/IconListingVariantBasic";
import SectionBaseMapInMapEditorFormat from "Features/baseMaps/components/SectionBaseMapInMapEditorFormat";

export default function SectionFormatBgImage() {
  const dispatch = useDispatch();

  // data

  const template = useBgImageFormTemplate();
  const item = useBgImageFormItem();

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
  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <FormGenericV2
        template={template}
        item={item}
        onItemChange={handleItemChange}
      />
    </Box>
  );
}
