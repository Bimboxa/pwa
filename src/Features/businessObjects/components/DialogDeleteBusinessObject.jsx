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
import useDeleteBusinessObject from "../hooks/useDeleteBusinessObject";
import { getBusinessObjectDescendants } from "../utils/buildBusinessObjectsTree";
import getMainRelsOfBusinessObjectsService from "../services/getMainRelsOfBusinessObjectsService";

export default function DialogDeleteBusinessObject({
  open,
  businessObject,
  onClose,
}) {
  const deleteBusinessObject = useDeleteBusinessObject();

  // state

  const [counts, setCounts] = useState(null); // {objects, rels, mains}

  // effects — cascade counts for the confirmation message

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const listingObjects = (
        await db.businessObjects
          .where("listingId")
          .equals(businessObject.listingId)
          .toArray()
      ).filter((o) => !o.deletedAt);
      const objectsToDelete = [
        businessObject,
        ...getBusinessObjectDescendants(listingObjects, businessObject.id),
      ];
      const objectIds = objectsToDelete.map((o) => o.id);
      const rels = await db.relsBusinessObjectAnnotation
        .where("businessObjectId")
        .anyOf(objectIds)
        .toArray();
      const mains = await getMainRelsOfBusinessObjectsService(objectIds);
      if (!cancelled)
        setCounts({
          objects: objectsToDelete.length,
          rels: rels.filter((r) => !r.deletedAt && !r.isMain).length,
          mains: mains.length,
        });
    })();
    return () => {
      cancelled = true;
    };
  }, [businessObject.id, businessObject.listingId]);

  // handlers

  async function handleDelete() {
    await deleteBusinessObject(businessObject);
    onClose();
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{`Supprimer l'ouvrage "${businessObject.label}" ?`}</DialogTitle>
      <DialogContent>
        {counts && (
          <Typography variant="body2" color="text.secondary">
            {counts.objects > 1
              ? `${counts.objects} ouvrages (sous-ouvrages inclus) seront supprimés.`
              : "1 ouvrage sera supprimé."}
            {counts.mains > 0 &&
              ` ${counts.mains} annotation${
                counts.mains > 1 ? "s" : ""
              } de localisation ${
                counts.mains > 1 ? "seront supprimées" : "sera supprimée"
              } du plan.`}
            {counts.rels > 0 &&
              ` ${counts.rels} liaison${counts.rels > 1 ? "s" : ""} d'annotation${
                counts.rels > 1 ? "s" : ""
              } seront retirées (les annotations sont conservées).`}
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
