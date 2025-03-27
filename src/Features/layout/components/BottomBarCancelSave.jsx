import {Box, Button} from "@mui/material";

export default function BottomBarCancelSave({
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
        width: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "end",
        p: 1,
        ...sx,
      }}
    >
      <Box sx={{flexGrow: 1}}>{children}</Box>
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
    </Box>
  );
}
