import { useDispatch, useSelector } from "react-redux";

import {
  Box,
  Card,
  Divider,
  FormControlLabel,
  Slider,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import {
  setShowGrid,
  setHideBaseMaps,
  setDisableOpacity,
  setAntiAliasingShrink,
  setFaceSelectionAngleDeg,
  setShowWireframe,
  setWireframeAngleDeg,
  setRenderMode,
  setEnvironment3d,
  setForceRevolutionSectionIn3d,
  setRevolutionSectionFillIn3d,
} from "Features/threedEditor/threedEditorSlice";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

// 3D view settings, shown by the right-panel SETTINGS tool while a 3D editor
// is displayed (see PanelEditorSettings). Holds the viewer toggles only:
// screenshot capture + legend display live in the "Capture" tool, the USDZ /
// OBJ scene download moved to the Export tool (SectionDownloadThreed), and
// the baseMap position tools moved to the horizontal baseMap chips band of
// the 3D viewer.
export default function PanelThreedProperties() {
  const dispatch = useDispatch();

  const showGrid = useSelector((s) => s.threedEditor.showGrid);
  const hideBaseMaps = useSelector((s) => s.threedEditor.hideBaseMaps);
  const disableOpacity = useSelector((s) => s.threedEditor.disableOpacity);
  const antiAliasingShrink = useSelector(
    (s) => s.threedEditor.antiAliasingShrink
  );
  const faceSelectionAngleDeg = useSelector(
    (s) => s.threedEditor.faceSelectionAngleDeg
  );
  const showWireframe = useSelector((s) => s.threedEditor.showWireframe);
  const wireframeAngleDeg = useSelector(
    (s) => s.threedEditor.wireframeAngleDeg
  );
  const forceRevolutionSection = useSelector(
    (s) => s.threedEditor.forceRevolutionSectionIn3d
  );
  const revolutionSectionFill = useSelector(
    (s) => s.threedEditor.revolutionSectionFillIn3d
  );
  const renderMode = useSelector((s) => s.threedEditor.renderMode);
  const environment3d = useSelector((s) => s.threedEditor.environment3d);

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
          {/* Display-only 180° half-view of profile revolutions (quantities
              stay full-rotation). OFF = full 360° revolutions; explicit
              per-axis sectors apply either way. */}
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={forceRevolutionSection}
                onChange={(e) =>
                  dispatch(setForceRevolutionSectionIn3d(e.target.checked))
                }
              />
            }
            label={
              <Typography variant="body2">Révolution partielle</Typography>
            }
          />
          {/* Fill the cut section of partial revolutions with a flat dark
              face (only when the profile is a closed contour). The ink
              boundary lines are always shown; only the fill is optional. */}
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={revolutionSectionFill}
                onChange={(e) =>
                  dispatch(setRevolutionSectionFillIn3d(e.target.checked))
                }
              />
            }
            label={<Typography variant="body2">Pochage des coupes</Typography>}
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
            Wireframe
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 1 }}
          >
            Arêtes noires dessinées sur les objets 3D. L&apos;angle de tolérance
            masque les arêtes entre facettes quasi-coplanaires : 1° dessine tout
            le maillage d&apos;une révolution, une valeur plus élevée ne garde
            que les silhouettes et les vrais plis.
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FormControlLabel
              sx={{ flexGrow: 1 }}
              control={
                <Switch
                  size="small"
                  checked={showWireframe}
                  onChange={(e) => dispatch(setShowWireframe(e.target.checked))}
                />
              }
              label={
                <Typography variant="body2">Afficher les arêtes</Typography>
              }
            />
            <TextField
              size="small"
              type="number"
              label="Angle (°)"
              value={wireframeAngleDeg}
              disabled={!showWireframe}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isNaN(v)) return;
                dispatch(setWireframeAngleDeg(Math.min(90, Math.max(0, v))));
              }}
              slotProps={{ htmlInput: { min: 0, max: 90, step: 1 } }}
              sx={{ width: 90 }}
            />
          </Box>
        </Card>

        <Card variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Sélection de face
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 1 }}
          >
            Angle maximum entre facettes voisines pour qu’elles appartiennent à
            la même face. Augmentez-le pour attraper une surface courbe
            (révolution, extrusion le long d’une courbe) d’un seul survol.
          </Typography>
          <Box sx={{ px: 1 }}>
            <Slider
              size="small"
              value={faceSelectionAngleDeg}
              min={0}
              max={60}
              step={1}
              marks={[
                { value: 0, label: "0°" },
                { value: 25, label: "25°" },
                { value: 60, label: "60°" },
              ]}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v}°`}
              onChange={(e, v) => dispatch(setFaceSelectionAngleDeg(v))}
            />
          </Box>
        </Card>

        <Card variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Rendu
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 1 }}
          >
            Réaliste : matériaux physiques + éclairage d&apos;ambiance.
            Photoréaliste : éclairage HDR, ombres portées du soleil et matériaux
            texturés. Aquarelle : croquis d&apos;architecte à l&apos;aquarelle.
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
            <ToggleButton value="PHOTOREAL" sx={{ textTransform: "none" }}>
              Photoréaliste
            </ToggleButton>
            <ToggleButton value="AQUARELLE" sx={{ textTransform: "none" }}>
              Aquarelle
            </ToggleButton>
          </ToggleButtonGroup>
          {renderMode === "PHOTOREAL" && (
            <>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 1.5, mb: 1 }}
              >
                Environnement : studio neutre, éclairage extérieur (soleil) ou
                intérieur (ex. parking). Sans ciel visible.
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                fullWidth
                value={environment3d}
                onChange={(_e, v) => {
                  if (v) dispatch(setEnvironment3d(v));
                }}
              >
                <ToggleButton value="STANDARD" sx={{ textTransform: "none" }}>
                  Standard
                </ToggleButton>
                <ToggleButton value="EXTERIOR" sx={{ textTransform: "none" }}>
                  Extérieur
                </ToggleButton>
                <ToggleButton value="INTERIOR" sx={{ textTransform: "none" }}>
                  Intérieur
                </ToggleButton>
              </ToggleButtonGroup>
            </>
          )}
        </Card>
      </Box>
    </BoxFlexVStretch>
  );
}
