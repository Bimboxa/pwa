import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import useDeleteWorkPackage from "../hooks/useDeleteWorkPackage";
import useRelsWorkPackageAnnotation from "../hooks/useRelsWorkPackageAnnotation";

export default function DialogDeleteWorkPackage({
  open,
  workPackage,
  onClose,
}) {
  const deleteWorkPackage = useDeleteWorkPackage();
  const { value: rels } = useRelsWorkPackageAnnotation({
    workPackageId: workPackage.id,
  });

  async function handleDelete() {
    await deleteWorkPackage(workPackage);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{`Supprimer la tâche "${workPackage.label}" ?`}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {rels.length > 0
            ? `${rels.length} liaison${rels.length > 1 ? "s" : ""} d'annotation${
                rels.length > 1 ? "s" : ""
              } et les blocs du planning seront supprimés. Les annotations du Dessin sont conservées.`
            : "Les blocs du planning de cette tâche seront supprimés."}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" color="error" onClick={handleDelete}>
          Supprimer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
