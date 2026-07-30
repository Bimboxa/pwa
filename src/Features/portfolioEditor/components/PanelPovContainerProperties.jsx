import { useDispatch } from "react-redux";

import { triggerSelectionBack } from "Features/selection/selectionSlice";

import useSelectedBaseMapContainer from "Features/portfolioBaseMapContainers/hooks/useSelectedBaseMapContainer";
import usePovs from "Features/pov/hooks/usePovs";
import getPovCaption from "Features/pov/utils/getPovCaption";
import getPovImageInfo from "Features/pov/utils/getPovImageInfo";

import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldSlider from "Features/form/components/FieldSlider";
import IconButtonMoreActionsBaseMapContainer from "./IconButtonMoreActionsBaseMapContainer";

import db from "App/db/db";

export default function PanelPovContainerProperties() {
  const dispatch = useDispatch();

  // strings

  const caption = "Bloc point de vue";

  // data

  const { value: container } = useSelectedBaseMapContainer();
  const povs = usePovs();

  // handlers

  async function handleOpacityChange(value) {
    await db.portfolioBaseMapContainers.update(container.id, {
      baseMapOpacity: value,
    });
  }

  async function handlePovChange(e) {
    const povId = e.target.value || null;
    const pov = povs?.find((p) => p.id === povId);
    const imageInfo = pov ? await getPovImageInfo(pov) : null;
    const viewBox = imageInfo
      ? { x: 0, y: 0, width: imageInfo.width, height: imageInfo.height }
      : null;
    await db.portfolioBaseMapContainers.update(container.id, {
      povId,
      viewBox,
    });
  }

  // render

  if (!container) return null;

  return (
    <BoxFlexVStretch>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 0.5,
          pl: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton onClick={() => dispatch(triggerSelectionBack())}>
            <Back />
          </IconButton>
          <Typography variant="body2" sx={{ fontWeight: "bold", ml: 1 }}>
            {caption}
          </Typography>
        </Box>

        <IconButtonMoreActionsBaseMapContainer container={container} />
      </Box>

      <Box sx={{ p: 1 }}>
        <WhiteSectionGeneric>
          <FormControl fullWidth size="small">
            <InputLabel>Point de vue</InputLabel>
            <Select
              value={container.povId || ""}
              label="Point de vue"
              onChange={handlePovChange}
            >
              {povs?.map((pov) => (
                <MenuItem key={pov.id} value={pov.id}>
                  {pov.description || getPovCaption(pov) || "Point de vue"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {Math.round(container.width)} x {Math.round(container.height)} pt
          </Typography>
        </WhiteSectionGeneric>

        <Box sx={{ mt: 1 }}>
          <WhiteSectionGeneric>
            <FieldSlider
              label="Opacité"
              value={container.baseMapOpacity ?? 1}
              onChange={handleOpacityChange}
            />
          </WhiteSectionGeneric>
        </Box>
      </Box>
    </BoxFlexVStretch>
  );
}
