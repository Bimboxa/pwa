import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";

import useSelectedBaseMapContainer from "Features/portfolioBaseMapContainers/hooks/useSelectedBaseMapContainer";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldSlider from "Features/form/components/FieldSlider";

import db from "App/db/db";
import computeDefaultViewBox from "../utils/computeDefaultViewBox";

export default function PanelBaseMapContainerProperties() {
  // data

  const { value: container } = useSelectedBaseMapContainer();
  const { value: baseMaps } = useBaseMaps();
  const updateEntity = useUpdateEntity();
  const { value: portfolio } = useDisplayedPortfolio();

  // handlers

  async function handleOpacityChange(value) {
    await db.portfolioBaseMapContainers.update(container.id, {
      baseMapOpacity: value,
    });
  }

  async function handleBaseMapChange(e) {
    const baseMapId = e.target.value || null;
    const bm = baseMaps?.find((b) => b.id === baseMapId);
    const viewBox = bm ? computeDefaultViewBox(bm, container) : null;
    await db.portfolioBaseMapContainers.update(container.id, {
      baseMapId,
      viewBox,
    });

    // rename page title to baseMap name on first assignment
    if (bm && container?.portfolioPageId && !container.baseMapId && portfolio) {
      const page = await db.portfolioPages.get(container.portfolioPageId);
      if (page && (page.title === "Page 1" || page.title === "Nouvelle page")) {
        await updateEntity(page.id, { title: bm.name }, { listing: portfolio });
      }
    }
  }

  // render

  if (!container) return null;

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Base map container
        </Typography>

        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
          <InputLabel>Base map</InputLabel>
          <Select
            value={container.baseMapId || ""}
            label="Base map"
            onChange={handleBaseMapChange}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {baseMaps?.map((bm) => (
              <MenuItem key={bm.id} value={bm.id}>
                {bm.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {Math.round(container.width)} x {Math.round(container.height)} pt
          </Typography>
        </Box>

        <Box sx={{ mt: 2 }}>
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
