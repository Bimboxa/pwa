import { useDispatch, useSelector } from "react-redux";

import {
  setMeshingModeActive,
  setMeshingMultiCut,
  setMeshingNumberingNext,
  setMeshingOffset,
  setMeshingTool,
} from "Features/threedEditor/threedEditorSlice";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

import {
  Box,
  Divider,
  IconButton,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import NearMeIcon from "@mui/icons-material/NearMe";
import TimelineIcon from "@mui/icons-material/Timeline";

import FieldNumberCompact from "./FieldNumberCompact";

// Tool glyphs match the mockup: plain strokes for the three cut lines.
const TOOLS = [
  {
    value: "SELECT",
    label: "Sélection — clic sur une face pour créer une maille",
    render: () => <NearMeIcon sx={{ fontSize: 18 }} />,
  },
  {
    value: "CUT_VERTICAL",
    label: "Trait de coupe vertical (S : changer de côté)",
    render: () => <Glyph>│</Glyph>,
  },
  {
    value: "CUT_HORIZONTAL",
    label: "Trait de coupe horizontal (S : changer de côté)",
    render: () => <Glyph>—</Glyph>,
  },
  {
    value: "CUT_FREE",
    label: "Trait de coupe libre — 2 clics sur les bords d'une maille",
    render: () => <Glyph>╱</Glyph>,
  },
  {
    value: "CUT_POLYLINE",
    label:
      "Polyligne de découpe — clics successifs depuis un bord, terminer sur un bord (Échap : annuler)",
    render: () => <TimelineIcon sx={{ fontSize: 18 }} />,
  },
  {
    value: "CUT_ANGULAR",
    label:
      "Découpe angulaire — 3 clics : extrémité A, sommet de l'angle O, extrémité B (saisir l'angle en degrés au clavier ; Échap : annuler)",
    render: () => <Glyph>∠</Glyph>,
  },
];

function Glyph({ children }) {
  return (
    <Box
      component="span"
      sx={{ fontSize: 16, lineHeight: 1, width: 18, textAlign: "center" }}
    >
      {children}
    </Box>
  );
}

// Specialized bottom toolbar shown while meshing mode is active. Replaces
// BottomToolbarThreed (same swap pattern as ClippingToolbarThreed). In the
// Maillage module (MESHES viewer) it is the only bottom toolbar, so the
// close button is hidden there.
export default function MeshingToolbarThreed() {
  const dispatch = useDispatch();

  const tool = useSelector((s) => s.threedEditor.meshingMode.tool);
  const offset = useSelector((s) => s.threedEditor.meshingMode.offset);
  const numberingNext = useSelector(
    (s) => s.threedEditor.meshingMode.numberingNext
  );
  const multiCut = useSelector((s) => s.threedEditor.meshingMode.multiCut);
  const isMeshesViewer = useSelector(selectEffectiveViewerKey) === "MESHES";

  // handlers

  function handleTool(_e, value) {
    if (!value) return; // ignore toggling the active tool off
    dispatch(setMeshingTool(value));
  }

  function handleOffsetChange(value) {
    if (value >= 0) dispatch(setMeshingOffset(value));
  }

  function handleNumberingNextChange(value) {
    const number = Math.round(value);
    if (number >= 1) dispatch(setMeshingNumberingNext(number));
  }

  function handleMultiCutToggle() {
    dispatch(setMeshingMultiCut(!multiCut));
  }

  function handleNumberingToggle() {
    dispatch(setMeshingTool(tool === "NUMBER" ? "SELECT" : "NUMBER"));
  }

  function handleClose() {
    dispatch(setMeshingModeActive(false));
  }

  // render

  return (
    <Paper
      elevation={3}
      sx={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        px: 1,
        py: 0.5,
        borderRadius: "10px",
        zIndex: 10,
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography sx={{ fontSize: 13, fontWeight: 500, px: 0.5 }}>
          Mailler
        </Typography>

        <ToggleButtonGroup exclusive value={tool} onChange={handleTool}>
          {TOOLS.map(({ value, label, render }) => (
            <Tooltip key={value} title={label}>
              <ToggleButton value={value} size="small">
                {render()}
              </ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>

        <Tooltip title="Découpe multi-mailles — le trait traverse aussi les mailles voisines qu'il rencontre (un trait horizontal sur 2 bandes verticales donne 4 mailles)">
          <ToggleButton
            value="MULTI_CUT"
            selected={multiCut}
            onChange={handleMultiCutToggle}
            size="small"
            sx={{ textTransform: "none", px: 1 }}
          >
            Multi-mailles
          </ToggleButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <FieldNumberCompact
          label="Décalage"
          value={offset}
          onChange={handleOffsetChange}
          unit="m"
        />

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <FieldNumberCompact
          label="N°"
          value={numberingNext}
          onChange={handleNumberingNextChange}
        />

        <Tooltip title="Numéroter — cliquez sur une maille pour lui affecter le numéro, puis +1">
          <ToggleButton
            value="NUMBER"
            selected={tool === "NUMBER"}
            onChange={handleNumberingToggle}
            size="small"
            sx={{ textTransform: "none", px: 1 }}
          >
            Numéroter
          </ToggleButton>
        </Tooltip>

        {!isMeshesViewer && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            <Tooltip title="Quitter le mode maillage">
              <IconButton onClick={handleClose}>
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Stack>
    </Paper>
  );
}
