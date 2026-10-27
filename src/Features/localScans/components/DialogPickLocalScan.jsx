/* eslint-disable react/prop-types */
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";

// Scan source picker: a PLY from this device or a scan already saved in the
// project resources.
export default function DialogPickLocalScan({
  open,
  available,
  onClose,
  onChooseFile,
  onPick,
}) {
  // render
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Charger un scan 3D</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Button variant="outlined" onClick={onChooseFile}>
            Choisir un fichier PLY sur cet appareil
          </Button>
          <Typography variant="caption" color="text.secondary">
            Le fichier sera enregistré dans les ressources du projet.
          </Typography>
          {available.length > 0 && (
            <>
              <Typography variant="subtitle2">
                Scans locaux du projet
              </Typography>
              <List>
                {available.map((row) => (
                  <ListItemButton key={row.id} onClick={() => onPick(row)}>
                    <ListItemText
                      primary={row.name}
                      secondary={stringifyFileSize(row.fileSize ?? row.size)}
                    />
                  </ListItemButton>
                ))}
              </List>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
      </DialogActions>
    </Dialog>
  );
}
