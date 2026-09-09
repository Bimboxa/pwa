import { useState } from "react";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";

import { CirclePicker } from "react-color";
import defaultColors from "Features/colors/data/defaultColors";

import useCreateWorkPackage from "../hooks/useCreateWorkPackage";
import useUpdateWorkPackage from "../hooks/useUpdateWorkPackage";

import SectionWorkPackageTasksPicker from "./SectionWorkPackageTasksPicker";

import { DEFAULT_BUSINESS_OBJECT_COLOR } from "../constants/businessObjectEntityModel";

// Create / edit form of a work package: label, covered tasks ("postes de
// travail") and colour. Its annotations are linked from the map (picking
// mode / multi-selection); a task only counts the linked annotations of its
// global layer. Edit mode when `workPackage` is provided.
export default function DialogWorkPackageForm({
  open,
  listing,
  workPackage,
  onClose,
}) {
  const createWorkPackage = useCreateWorkPackage();
  const updateWorkPackage = useUpdateWorkPackage();

  const isEdit = Boolean(workPackage);
  const [label, setLabel] = useState(workPackage?.label ?? "");
  const [color, setColor] = useState(
    workPackage?.color ?? DEFAULT_BUSINESS_OBJECT_COLOR
  );
  // tasks covered by the package ([] = every task of the listing)
  const [workStationIds, setWorkStationIds] = useState(
    workPackage?.workStationIds ?? []
  );

  async function handleSubmit() {
    if (!label) return;
    if (isEdit)
      await updateWorkPackage(workPackage.id, {
        label,
        color,
        workStationIds,
      });
    else await createWorkPackage({ listing, label, color, workStationIds });
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {isEdit ? "Modifier la tâche" : "Nouvelle tâche"}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Nom"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && label) handleSubmit();
          }}
          sx={{ mt: 1 }}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 2 }}
        >
          Postes de travail
        </Typography>
        <SectionWorkPackageTasksPicker
          listingId={listing.id}
          value={workStationIds}
          onChange={setWorkStationIds}
        />

        <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
          <CirclePicker
            onChange={(c) => setColor(c.hex)}
            color={color}
            colors={defaultColors}
            circleSize={20}
            circleSpacing={9}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!label}>
          {isEdit ? "Modifier" : "Créer"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
