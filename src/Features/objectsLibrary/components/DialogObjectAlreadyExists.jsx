import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

// Shown on "Localiser" when the target listing already holds a template created
// from the same library model (matching modelIdMaster). The user either creates a
// new model or reuses the existing template.
export default function DialogObjectAlreadyExists({
  open,
  object,
  existingTemplate,
  listingName,
  onClose,
  onCreateNew,
  onUseExisting,
}) {
  if (!object || !existingTemplate) return null;

  const existingLabel = existingTemplate.label || "sans nom";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Modèle déjà présent</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          Un modèle <b>{object.label}</b> existe déjà dans <b>{listingName}</b>{" "}
          : <b>{existingLabel}</b>.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: "wrap" }}>
        <Button onClick={onCreateNew}>Créer un nouveau modèle</Button>
        <Button variant="contained" onClick={onUseExisting}>
          Utiliser «&nbsp;{existingLabel}&nbsp;»
        </Button>
      </DialogActions>
    </Dialog>
  );
}
