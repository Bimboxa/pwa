import { useDispatch, useSelector } from "react-redux";

import { setOpencvPreviewUrl } from "../opencvSlice";
import { clearKeepColorsPreviewUrl } from "../opencvSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useUpdateBaseMapWithImageEnhanced from "Features/baseMaps/hooks/useUpdateBaseMapWithImageEnhanced";

import { Box } from "@mui/material";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import imageUrlToPng from "Features/images/utils/imageUrlToPng";

export default function SectionSaveOpencvPreview() {
  const dispatch = useDispatch();
  // strings

  const saveS = "Enregistrer";
  const cancelS = "Annuler";

  // data

  const previewUrl = useSelector((state) => state.opencv.opencvPreviewUrl);
  const baseMap = useMainBaseMap();
  const update = useUpdateBaseMapWithImageEnhanced();

  // handlers

  async function handleSave() {
    const file = await imageUrlToPng({
      url: previewUrl,
      name: "keep-color.png",
    });
    await update(baseMap.id, file);
    dispatch(clearKeepColorsPreviewUrl());
    setBlob(null);
  }

  function handleCancel() {
    dispatch(setOpencvPreviewUrl(null));
  }

  // render

  return (
    <Box sx={{ display: "flex", width: 1, alignItems: "center" }}>
      <Box sx={{ display: "flex", flex: 1, p: 1 }}>
        <ButtonGeneric
          label={cancelS}
          onClick={handleCancel}
          fullWidth
          variant="outlined"
        />
      </Box>
      <Box sx={{ display: "flex", flex: 1, p: 1 }}>
        <ButtonGeneric
          label={saveS}
          onClick={handleSave}
          fullWidth
          variant="contained"
          color="secondary"
        />
      </Box>
    </Box>
  );
}
