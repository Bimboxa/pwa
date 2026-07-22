import { useDispatch, useSelector } from "react-redux";

import {
  setHideAnnotationsIn3d,
  setMesh3dLabels,
} from "Features/threedEditor/threedEditorSlice";

import {
  Box,
  Button,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { FilterCenterFocus, GridOn } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import { hasMesh3dLabelOffset } from "../hooks/useResetMeshes3dLabelPositions";

// "Réglages" tab of the mailles drawer: display settings moved from the old
// rightPanel PanelMesh3d. No "Masquer les mailles" toggle here — mailles are
// always displayed in the MESHES viewer.
export default function SectionMeshes3dSettings({
  prefix,
  onPrefixChange,
  meshes3d,
  onResetLabelPositions,
}) {
  const dispatch = useDispatch();

  // data

  const hideAnnotationsIn3d = useSelector(
    (s) => s.threedEditor.hideAnnotationsIn3d
  );
  const mesh3dLabels = useSelector((s) => s.threedEditor.mesh3dLabels);

  // helpers

  const movedLabelsCount = (meshes3d || []).filter(hasMesh3dLabelOffset).length;

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1 }}>
      {/* Card — Affichage */}
      <WhiteSectionGeneric>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <GridOn fontSize="small" color="action" />
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            Affichage
          </Typography>
        </Box>
        <FormControlLabel
          sx={{ ml: 0, mt: 0.5 }}
          control={
            <Switch
              size="small"
              checked={hideAnnotationsIn3d}
              onChange={(e) =>
                dispatch(setHideAnnotationsIn3d(e.target.checked))
              }
            />
          }
          label={
            <Typography variant="body2">Masquer les annotations</Typography>
          }
        />
      </WhiteSectionGeneric>

      {/* Card — Étiquette */}
      <WhiteSectionGeneric>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          Étiquette
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", mt: 0.5 }}>
          <FormControlLabel
            sx={{ ml: 0 }}
            control={
              <Switch
                size="small"
                checked={mesh3dLabels.visible}
                onChange={(e) =>
                  dispatch(setMesh3dLabels({ visible: e.target.checked }))
                }
              />
            }
            label={
              <Typography variant="body2">Afficher les étiquettes</Typography>
            }
          />
          <FormControlLabel
            sx={{ ml: 0 }}
            control={
              <Switch
                size="small"
                checked={mesh3dLabels.showNumber}
                disabled={!mesh3dLabels.visible}
                onChange={(e) =>
                  dispatch(setMesh3dLabels({ showNumber: e.target.checked }))
                }
              />
            }
            label={<Typography variant="body2">Afficher le numéro</Typography>}
          />
          <FormControlLabel
            sx={{ ml: 0 }}
            control={
              <Switch
                size="small"
                checked={mesh3dLabels.showQties}
                disabled={!mesh3dLabels.visible}
                onChange={(e) =>
                  dispatch(setMesh3dLabels({ showQties: e.target.checked }))
                }
              />
            }
            label={
              <Typography variant="body2">Afficher les quantités</Typography>
            }
          />
        </Box>

        {/* Bulk version of the per-maille "Recentrer l'étiquette" */}
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FilterCenterFocus fontSize="small" />}
            disabled={!movedLabelsCount}
            onClick={onResetLabelPositions}
          >
            Réinitialiser les positions
          </Button>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.5 }}
          >
            Replace chaque étiquette déplacée sur sa maille.
          </Typography>
        </Box>
      </WhiteSectionGeneric>

      {/* Card — Numérotation */}
      <WhiteSectionGeneric>
        <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
          Numérotation
        </Typography>
        <TextField
          label="Préfixe"
          size="small"
          fullWidth
          value={prefix}
          onChange={(e) => onPrefixChange(e.target.value)}
          helperText={`Aperçu : ${prefix}1, ${prefix}2, …`}
        />
      </WhiteSectionGeneric>
    </Box>
  );
}
