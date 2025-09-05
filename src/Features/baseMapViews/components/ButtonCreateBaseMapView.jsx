import { Button, Typography } from "@mui/material";
import { Add } from "@mui/icons-material";

export default function ButtonCreateBaseMapView() {
  // title

  const saveS = "Enregistrer comme plan";

  // handlers

  function handleSave() {}

  // return

  return (
    <Button startIcon={<Add />} variant="contained" color="secondary">
      <Typography variant="body2">{saveS}</Typography>
    </Button>
  );
}
