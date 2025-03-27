import {Box, Button} from "@mui/material";

export default function BlockButtonsCancelSave({
  onSave,
  onCancel,
  loading,
  sx,
  children,
}) {
  const cancelS = "Annuler";
  const saveS = "Enregistrer";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
      }}
    >
      <Button onClick={onCancel} variant="outlined" sx={{mr: 1}}>
        {cancelS}
      </Button>
      <Button onClick={onSave} variant="contained">
        {saveS}
      </Button>
    </Box>
  );
}
