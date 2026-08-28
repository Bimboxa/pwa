import { useState } from "react";
import { useSelector } from "react-redux";

import {
  Button,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ViewInAr from "@mui/icons-material/ViewInAr";

import exportSceneAsUsdzService from "Features/threedEditor/services/exportSceneAsUsdzService";
import exportSceneAsObjService from "Features/threedEditor/services/exportSceneAsObjService";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

// "Télécharger la 3D" card (USDZ / OBJ scene export), shown by the Export tool
// while a 3D editor is displayed. Moved out of the 3D settings panel
// (PanelThreedProperties) when the Export tool was refocused on data exports.
export default function SectionDownloadThreed() {
  // state

  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState("USDZ"); // "USDZ" | "OBJ"

  // data

  const hideBaseMaps = useSelector((s) => s.threedEditor.hideBaseMaps);

  // handlers

  async function handleDownload3D() {
    if (exporting) return;
    setExporting(true);
    // Yield to the browser so the spinner gets painted before the heavy
    // synchronous portion of the encode (USDZ: texture bitmap reads + zip).
    await new Promise((r) => requestAnimationFrame(r));
    try {
      const options = { excludeBaseMaps: hideBaseMaps };
      if (exportFormat === "OBJ") {
        exportSceneAsObjService("scene.obj", options);
      } else {
        await exportSceneAsUsdzService("scene.usdz", options);
      }
    } catch (e) {
      console.error("[SectionDownloadThreed] 3D export failed", e);
    } finally {
      setExporting(false);
    }
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
        Télécharger la 3D
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 1.25 }}
      >
        Export de la scène (fond de plan + objets 3D). USDZ pour iPhone / AR,
        OBJ pour SketchUp.
      </Typography>
      <ToggleButtonGroup
        size="small"
        exclusive
        fullWidth
        value={exportFormat}
        onChange={(_e, v) => {
          if (v) setExportFormat(v);
        }}
        disabled={exporting}
        sx={{ mb: 1.25 }}
      >
        <ToggleButton value="USDZ" sx={{ textTransform: "none" }}>
          USDZ (iPhone / AR)
        </ToggleButton>
        <ToggleButton value="OBJ" sx={{ textTransform: "none" }}>
          OBJ (SketchUp)
        </ToggleButton>
      </ToggleButtonGroup>
      <Button
        size="small"
        variant="outlined"
        fullWidth
        startIcon={
          exporting ? (
            <CircularProgress size={14} thickness={5} />
          ) : (
            <ViewInAr sx={{ fontSize: 16 }} />
          )
        }
        disabled={exporting}
        onClick={handleDownload3D}
      >
        {exporting
          ? "Export en cours…"
          : `Télécharger (.${exportFormat.toLowerCase()})`}
      </Button>
    </WhiteSectionGeneric>
  );
}
