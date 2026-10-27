import { useDispatch, useSelector } from "react-redux";
import { setLocalScansEnabled } from "Features/threedEditor/threedEditorSlice";
import { Card, FormControlLabel, Switch, Typography } from "@mui/material";

export default function SectionLocalScans() {
  const dispatch = useDispatch();
  const enabled = useSelector((s) => s.threedEditor.localScansEnabled);
  return (
    <Card variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            onChange={(_, checked) => dispatch(setLocalScansEnabled(checked))}
          />
        }
        label="Scans locaux : points et Gaussian Splatting"
      />
      <Typography variant="body2" color="text.secondary">
        Expérimental, sur cet appareil. Active l’import PLY dans la vue 3D. Les
        scans restent dans le navigateur. Désactiver libère les ressources du
        moteur sans effacer les fichiers enregistrés.
      </Typography>
    </Card>
  );
}
