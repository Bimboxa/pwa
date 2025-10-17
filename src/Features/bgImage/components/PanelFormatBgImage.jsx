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

export default function PanelFormatBgImage() {
  const dispatch = useDispatch();

  // strings

  const title = "Gabarit d'impression";

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
    <BoxFlexVStretch sx={{ bgcolor: "white" }}>
      <Box sx={{ display: "flex", alignItems: "center", p: 1 }}>
        <IconListingVariantBasic
          listing={{
            iconKey: "background",
            color: theme.palette.secondary.light,
          }}
        />
        <Typography sx={{ ml: 1, fontWeight: "bold" }}>{title}</Typography>
      </Box>
      <FormGenericV2
        template={template}
        item={item}
        onItemChange={handleItemChange}
      />
    </BoxFlexVStretch>
  );
}
