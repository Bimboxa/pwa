import { useDispatch, useSelector } from "react-redux";
import { Box, Button, Chip } from "@mui/material";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import useToggleModuleEditor from "Features/viewers/hooks/useToggleModuleEditor";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { registerScanPanelHost } from "../services/scanPanelHost";

export default function Scan3dPanelHost() {
  const dispatch = useDispatch();
  const viewer = useSelector(selectEffectiveViewerKey);
  const toggleEditor = useToggleModuleEditor();
  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}
    >
      <HeaderTitleClose
        title="Scan 3D"
        actions={
          <Chip
            label="Outil expérimental"
            size="small"
            color="warning"
            variant="outlined"
          />
        }
        onClose={() => dispatch(setSelectedMenuItemKey(null))}
      />
      {!isThreedFamilyViewerKey(viewer) ? (
        <Box sx={{ p: 2 }}>
          <Button variant="outlined" fullWidth onClick={toggleEditor}>
            Charger un modèle 3D…
          </Button>
        </Box>
      ) : (
        <Box
          ref={registerScanPanelHost}
          sx={{
            minHeight: 0,
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        />
      )}
    </Box>
  );
}
