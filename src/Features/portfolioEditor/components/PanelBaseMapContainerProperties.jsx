import { useDispatch, useSelector } from "react-redux";

import { setFramingContainerId } from "Features/portfolioBaseMapContainers/portfolioBaseMapContainersSlice";
import {
  setSelectedViewerKey,
  setPortfolioReturnContext,
} from "Features/viewers/viewersSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import {
  Box,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { CropFree, RestartAlt, Edit } from "@mui/icons-material";

import useSelectedBaseMapContainer from "Features/portfolioBaseMapContainers/hooks/useSelectedBaseMapContainer";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useBaseMap from "Features/baseMaps/hooks/useBaseMap";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import db from "App/db/db";
import computeDefaultViewBox from "../utils/computeDefaultViewBox";

export default function PanelBaseMapContainerProperties() {
  const dispatch = useDispatch();

  // data

  const { value: container } = useSelectedBaseMapContainer();
  const { value: baseMaps } = useBaseMaps();
  const baseMap = useBaseMap({ id: container?.baseMapId });
  const framingContainerId = useSelector(
    (s) => s.portfolioBaseMapContainers.framingContainerId
  );
  const displayedPortfolioId = useSelector(
    (s) => s.portfolios.displayedPortfolioId
  );

  // helpers

  const isFraming = framingContainerId === container?.id;

  // handlers

  async function handleBaseMapChange(e) {
    const baseMapId = e.target.value || null;
    const bm = baseMaps?.find((b) => b.id === baseMapId);
    const viewBox = bm ? computeDefaultViewBox(bm, container) : null;
    await db.portfolioBaseMapContainers.update(container.id, {
      baseMapId,
      viewBox,
    });
  }

  function handleFrame() {
    dispatch(setFramingContainerId(isFraming ? null : container.id));
  }

  async function handleReset() {
    if (!baseMap || !container) return;
    const viewBox = computeDefaultViewBox(baseMap, container);
    await db.portfolioBaseMapContainers.update(container.id, { viewBox });
    dispatch(setFramingContainerId(null));
  }

  function handleEditInMap() {
    if (!container?.baseMapId) return;
    dispatch(
      setPortfolioReturnContext({
        fromPortfolio: true,
        portfolioId: displayedPortfolioId,
        pageId: container.portfolioPageId,
        containerId: container.id,
      })
    );
    dispatch(setSelectedMainBaseMapId(container.baseMapId));
    dispatch(setSelectedViewerKey("MAP"));
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

        {container.baseMapId && (
          <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                size="small"
                variant={isFraming ? "contained" : "outlined"}
                startIcon={<CropFree />}
                onClick={handleFrame}
              >
                {isFraming ? "Terminer" : "Cadrer"}
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RestartAlt />}
                onClick={handleReset}
              >
                Reset
              </Button>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Edit />}
              onClick={handleEditInMap}
              fullWidth
            >
              Modifier le reperage
            </Button>
          </Box>
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {Math.round(container.width)} x {Math.round(container.height)} pt
          </Typography>
        </Box>
      </Box>
    </BoxFlexVStretch>
  );
}
