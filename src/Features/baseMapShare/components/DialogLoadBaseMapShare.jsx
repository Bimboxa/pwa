import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { Box } from "@mui/material";

import {
  setSelectedBaseMapsListingId,
  setSelectedMainBaseMapId,
} from "Features/mapEditor/mapEditorSlice";

import db from "App/db/db";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxCenter from "Features/layout/components/BoxCenter";
import ContainerFilesSelector from "Features/files/components/ContainerFilesSelector";

import loadBaseMapShareZip from "../services/loadBaseMapShareZip";

export default function DialogLoadBaseMapShare({ open, onClose }) {
  // data

  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const baseMapsListingId = useSelector(
    (s) => s.mapEditor.selectedBaseMapsListingId
  );

  // state

  const [loading, setLoading] = useState(false);

  // handlers

  async function handleFilesChange(files) {
    const file = files?.[0];
    if (!file) {
      onClose?.();
      return;
    }
    try {
      setLoading(true);
      // Import the base map(s) into the scope's current base-map listing
      // instead of creating a duplicate "Fonds de plan" listing.
      const { baseMapId } = await loadBaseMapShareZip(file, {
        projectId,
        scopeId,
        baseMapsListingId,
      });
      // Select the freshly imported base map so it (and its annotations) show
      // immediately.
      if (baseMapId) {
        const baseMap = await db.baseMaps.get(baseMapId);
        if (baseMap?.listingId) {
          dispatch(setSelectedBaseMapsListingId(baseMap.listingId));
        }
        dispatch(setSelectedMainBaseMapId(baseMapId));
      }
    } catch (err) {
      console.error("loadBaseMapShareZip failed", err);
    } finally {
      setLoading(false);
      onClose?.();
    }
  }

  // render

  return (
    <DialogGeneric open={open} onClose={onClose}>
      <Box sx={{ width: 300, height: 300, p: 2 }}>
        <BoxCenter
          sx={{ border: (theme) => `1px solid ${theme.palette.divider}` }}
        >
          <ContainerFilesSelector
            onFilesChange={handleFilesChange}
            callToActionLabel="Charger un fond de plan avec annotations"
            accept=".zip"
            loading={loading}
          />
        </BoxCenter>
      </Box>
    </DialogGeneric>
  );
}
