import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  Box,
  Button,
  Card,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ViewInAr from "@mui/icons-material/ViewInAr";

import {
  setShowGrid,
  setHideBaseMaps,
  setDisableOpacity,
  setAntiAliasingShrink,
  setRenderMode,
} from "Features/threedEditor/threedEditorSlice";
import exportSceneAsUsdzService from "Features/threedEditor/services/exportSceneAsUsdzService";
import exportSceneAsObjService from "Features/threedEditor/services/exportSceneAsObjService";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

// 3D view settings, shown by the right-panel SETTINGS tool while a 3D editor
// is displayed (see PanelEditorSettings). Holds the viewer toggles plus the
// USDZ / OBJ export action. Screenshot capture + legend display moved to the
// shared "Export rapide" flow (Export panel); the baseMap position tools
// moved to the horizontal baseMap chips band of the 3D viewer.
export default function PanelThreedProperties() {
  const dispatch = useDispatch();

  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState("USDZ"); // "USDZ" | "OBJ"

  const showGrid = useSelector((s) => s.threedEditor.showGrid);
  const hideBaseMaps = useSelector((s) => s.threedEditor.hideBaseMaps);
  const disableOpacity = useSelector((s) => s.threedEditor.disableOpacity);
  const antiAliasingShrink = useSelector(
    (s) => s.threedEditor.antiAliasingShrink
  );
  const renderMode = useSelector((s) => s.threedEditor.renderMode);
  const clippingEnabled = useSelector(
    (s) => s.threedEditor.clippingPlane.enabled
  );
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
      console.error("[PanelThreedProperties] 3D export failed", e);
    } finally {
      setExporting(false);
    }
  }

  // render

  return (
    <BoxFlexVStretch sx={{ height: 1 }}>
      <Box sx={{ p: 2, overflowY: "auto", flexGrow: 1, minHeight: 0 }}>
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showGrid}
                onChange={(e) => dispatch(setShowGrid(e.target.checked))}
              />
            }
            label={<Typography variant="body2">Afficher la grille</Typography>}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={hideBaseMaps}
                onChange={(e) => dispatch(setHideBaseMaps(e.target.checked))}
              />
            }
            label={
              <Typography variant="body2">Masquer les fonds de plan</Typography>
            }
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={!disableOpacity}
                onChange={(e) => dispatch(setDisableOpacity(!e.target.checked))}
              />
            }
            label={
              <Typography variant="body2">
                Transparence des annotations
              </Typography>
            }
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={antiAliasingShrink}
                onChange={(e) =>
                  dispatch(setAntiAliasingShrink(e.target.checked))
                }
              />
            }
            label={
              <Typography variant="body2">
                Réduire le crénelage des parements
              </Typography>
            }
          />
        </Box>

        <Divider sx={{ my: 1.5 }} />

        <Card variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Rendu
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 1 }}
          >
            Réaliste : matériaux + ombres en temps réel. Photoréaliste : rendu
            progressif (l'image converge quand la caméra est immobile),
            indisponible avec le plan de coupe.
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            fullWidth
            value={renderMode}
            onChange={(_e, v) => {
              if (v) dispatch(setRenderMode(v));
            }}
          >
            <ToggleButton value="STANDARD" sx={{ textTransform: "none" }}>
              Standard
            </ToggleButton>
            <ToggleButton value="REALISTIC" sx={{ textTransform: "none" }}>
              Réaliste
            </ToggleButton>
            <ToggleButton
              value="PHOTOREAL"
              sx={{ textTransform: "none" }}
              disabled={clippingEnabled}
            >
              Photoréaliste
            </ToggleButton>
          </ToggleButtonGroup>
        </Card>

        <Card variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Télécharger la 3D
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 1.25 }}
          >
            Export de la scène (fond de plan + objets 3D). USDZ pour iPhone /
            AR, OBJ pour SketchUp.
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
        </Card>
      </Box>
    </BoxFlexVStretch>
  );
}
