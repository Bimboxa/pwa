import { useSelector } from "react-redux";
import { Box, Button } from "@mui/material";
import Scan3dHeader from "./Scan3dHeader";
import useToggleModuleEditor from "Features/viewers/hooks/useToggleModuleEditor";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { registerScanPanelHost } from "../services/scanPanelHost";

export default function Scan3dPanelHost() {
  const viewer = useSelector(selectEffectiveViewerKey);
  const toggleEditor = useToggleModuleEditor();
  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}
    >
      {!isThreedFamilyViewerKey(viewer) ? (
        <>
          <Scan3dHeader />
          <Box sx={{ p: 2 }}>
            <Button variant="outlined" fullWidth onClick={toggleEditor}>
              Charger un modèle 3D…
            </Button>
          </Box>
        </>
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
