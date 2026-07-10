import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  Box,
  Button,
  Card,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ViewInAr from "@mui/icons-material/ViewInAr";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import Download from "@mui/icons-material/Download";
import ContentCopy from "@mui/icons-material/ContentCopy";

import {
  setShowGrid,
  setHideBaseMaps,
  setShowLegend,
  setLegendShowQty,
  setLegendSize,
  setDisableOpacity,
  setAntiAliasingShrink,
  setEditorMode,
} from "Features/threedEditor/threedEditorSlice";
import DialogExportPhotoreal from "Features/photorealRender/components/DialogExportPhotoreal";
import exportSceneAsUsdzService from "Features/threedEditor/services/exportSceneAsUsdzService";
import exportSceneAsObjService from "Features/threedEditor/services/exportSceneAsObjService";
import captureSceneScreenshotService from "Features/threedEditor/services/captureSceneScreenshotService";
import PanelBaseMapPosition3D from "./PanelBaseMapPosition3D";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

function timestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

// Right-panel content for the 3D viewer. Auto-opened when the user enters the
// THREED viewer (see MainThreedEditor). Holds the viewer toggles plus the
// USDZ / photoreal / screenshot export actions.
export default function PanelThreedProperties() {
  const dispatch = useDispatch();

  const [tab, setTab] = useState("SCENE"); // "SCENE" | "BASEMAP"
  const [exportPreset, setExportPreset] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState("USDZ"); // "USDZ" | "OBJ"
  const [capturedImage, setCapturedImage] = useState(null);
  const [copied, setCopied] = useState(false);

  // While the "Fonds de plan" tab is active, put the 3D viewer in
  // BASEMAP_POSITION mode (pointer reserved for the transform gizmo, annotation
  // selection/hover suppressed). Restore navigation when leaving the tab — and
  // on unmount (panel closed / left the 3D viewer) so the viewer isn't stuck
  // with annotation interactions disabled.
  const prevTabRef = useRef("SCENE");
  useEffect(() => {
    const prev = prevTabRef.current;
    if (tab === "BASEMAP" && prev !== "BASEMAP") {
      dispatch(setEditorMode("BASEMAP_POSITION"));
    } else if (tab !== "BASEMAP" && prev === "BASEMAP") {
      dispatch(setEditorMode("NAVIGATION"));
    }
    prevTabRef.current = tab;
  }, [tab, dispatch]);
  useEffect(() => {
    return () => {
      if (prevTabRef.current === "BASEMAP") {
        dispatch(setEditorMode("NAVIGATION"));
      }
    };
  }, [dispatch]);

  const showGrid = useSelector((s) => s.threedEditor.showGrid);
  const hideBaseMaps = useSelector((s) => s.threedEditor.hideBaseMaps);
  const showLegend = useSelector((s) => s.threedEditor.showLegend);
  const legendShowQty = useSelector((s) => s.threedEditor.legendShowQty);
  const legendSize = useSelector((s) => s.threedEditor.legendSize);
  const disableOpacity = useSelector((s) => s.threedEditor.disableOpacity);
  const antiAliasingShrink = useSelector(
    (s) => s.threedEditor.antiAliasingShrink
  );
  // handlers

  function handleStartExport(presetKey) {
    setExportPreset(presetKey);
  }
  function handleCloseExport() {
    setExportPreset(null);
  }
  async function handleCapture() {
    try {
      setCapturedImage(await captureSceneScreenshotService());
    } catch (e) {
      console.error("[PanelThreedProperties] capture failed", e);
    }
  }
  function handleDownloadCapture() {
    if (!capturedImage) return;
    const a = document.createElement("a");
    a.href = capturedImage;
    a.download = `capture-3d-${timestamp()}.png`;
    a.click();
  }
  async function handleCopyCapture() {
    if (!capturedImage) return;
    try {
      const blob = await dataUrlToBlob(capturedImage);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("[PanelThreedProperties] copy capture failed", e);
    }
  }
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
      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 40,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          "& .MuiTab-root": { minHeight: 40, textTransform: "none" },
        }}
      >
        <Tab value="SCENE" label="Scène 3D" />
        <Tab value="BASEMAP" label="Fonds de plan" />
      </Tabs>

      {tab === "SCENE" && (
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
              label={
                <Typography variant="body2">Afficher la grille</Typography>
              }
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
                <Typography variant="body2">
                  Masquer les fonds de plan
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={!disableOpacity}
                  onChange={(e) =>
                    dispatch(setDisableOpacity(!e.target.checked))
                  }
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
              Légende
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={showLegend}
                  onChange={(e) => dispatch(setShowLegend(e.target.checked))}
                />
              }
              label={
                <Typography variant="body2">Afficher la légende</Typography>
              }
            />
            <FormControlLabel
              disabled={!showLegend}
              control={
                <Switch
                  size="small"
                  checked={legendShowQty}
                  onChange={(e) => dispatch(setLegendShowQty(e.target.checked))}
                />
              }
              label={<Typography variant="body2">Quantité</Typography>}
            />
            <Box sx={{ mt: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 0.5 }}
              >
                Taille
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                disabled={!showLegend}
                value={legendSize}
                onChange={(_e, v) => {
                  if (v) dispatch(setLegendSize(v));
                }}
              >
                <ToggleButton value="SMALL" sx={{ textTransform: "none" }}>
                  Petite
                </ToggleButton>
                <ToggleButton value="MEDIUM" sx={{ textTransform: "none" }}>
                  Moyenne
                </ToggleButton>
                <ToggleButton value="LARGE" sx={{ textTransform: "none" }}>
                  Grande
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
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

          <Card variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Export photoréaliste
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 1.25 }}
            >
              Rendu path-tracing de la vue 3D actuelle. Le fond est transparent
              dans le PNG (pratique pour intégration dans un PDF).
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                fullWidth
                onClick={() => handleStartExport("QUICK")}
              >
                Rapide
              </Button>
              <Button
                size="small"
                variant="contained"
                color="secondary"
                fullWidth
                onClick={() => handleStartExport("HIGH")}
              >
                Haute qualité
              </Button>
            </Box>
          </Card>

          <Card variant="outlined" sx={{ p: 1.5, mt: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Capture d'écran
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 1.25 }}
            >
              Capture instantanée de la vue 3D actuelle (fond de plan +
              annotations).
            </Typography>
            <Box
              sx={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 9",
                mb: 1.25,
                borderRadius: 1,
                border: "1px dashed",
                borderColor: "divider",
                backgroundColor: "grey.100",
                backgroundImage: capturedImage
                  ? `url(${capturedImage})`
                  : "none",
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {!capturedImage && (
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{
                    position: "absolute",
                    top: 8,
                    left: 0,
                    right: 0,
                    textAlign: "center",
                  }}
                >
                  Aucune capture
                </Typography>
              )}
              <Button
                size="small"
                variant="contained"
                startIcon={<PhotoCamera sx={{ fontSize: 16 }} />}
                onClick={handleCapture}
                sx={capturedImage ? { boxShadow: 2 } : undefined}
              >
                Capturer
              </Button>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                fullWidth
                startIcon={<Download sx={{ fontSize: 16 }} />}
                disabled={!capturedImage}
                onClick={handleDownloadCapture}
              >
                Télécharger
              </Button>
              <Button
                size="small"
                variant="contained"
                color="secondary"
                fullWidth
                startIcon={<ContentCopy sx={{ fontSize: 16 }} />}
                disabled={!capturedImage}
                onClick={handleCopyCapture}
              >
                {copied ? "Copié" : "Copier"}
              </Button>
            </Box>
          </Card>
        </Box>
      )}

      {tab === "BASEMAP" && (
        <Box sx={{ p: 2, overflowY: "auto", flexGrow: 1, minHeight: 0 }}>
          <PanelBaseMapPosition3D />
        </Box>
      )}

      <DialogExportPhotoreal
        presetKey={exportPreset}
        onClose={handleCloseExport}
      />
    </BoxFlexVStretch>
  );
}
