import { useEffect, useState } from "react";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import db from "App/db/db";
import useDeleteZone from "../hooks/useDeleteZone";
import { getZoneDescendants } from "../utils/buildZonesTree";

export default function DialogDeleteZone({ open, zone, listing, onClose }) {
  const deleteZone = useDeleteZone();

  // state

  const [counts, setCounts] = useState(null); // {zones, annotations}

  // effects — cascade counts for the confirmation message

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const listingZones = (
        await db.zones.where("listingId").equals(listing.id).toArray()
      ).filter((z) => !z.deletedAt);
      const zonesToDelete = [
        zone,
        ...getZoneDescendants(listingZones, zone.id),
      ];
      const templateIds = zonesToDelete.map((z) => z.templateId).filter(Boolean);
      let annotationsCount = 0;
      if (templateIds.length > 0) {
        const annotations = await db.annotations
          .where("annotationTemplateId")
          .anyOf(templateIds)
          .toArray();
        annotationsCount = annotations.filter((a) => !a.deletedAt).length;
      }
      if (!cancelled)
        setCounts({ zones: zonesToDelete.length, annotations: annotationsCount });
    })();
    return () => {
      cancelled = true;
    };
  }, [zone.id, listing.id]);

  // handlers

  async function handleDelete() {
    await deleteZone(zone);
    onClose();
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{`Supprimer la zone "${zone.label}" ?`}</DialogTitle>
      <DialogContent>
        {counts && (
          <Typography variant="body2" color="text.secondary">
            {counts.zones > 1
              ? `${counts.zones} zones (sous-zones incluses)`
              : "1 zone"}
            {counts.annotations > 0
              ? ` et ${counts.annotations} annotation${
                  counts.annotations > 1 ? "s" : ""
                } seront supprimées.`
              : " sera supprimée."}
          </Typography>
        )}
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
