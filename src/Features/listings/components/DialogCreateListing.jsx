import { useState, useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";
import { setSelectedListingId, setOpenedPanel } from "../listingsSlice";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useCreateListings from "../hooks/useCreateListings";
import useCreateListingsFromPresetListingsKeys from "../hooks/useCreateListingsFromPresetListingsKeys";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useResolvedPresetListings from "../hooks/useResolvedPresetListings";

import {
  Box,
  Button,
  Divider,
  TextField,
  Typography,
} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import SectionPresetListingsSelector from "./SectionPresetListingsSelector";
import SectionPresetListingsPreview from "./SectionPresetListingsPreview";

export default function DialogCreateListing({
  open,
  onClose,
  isForBaseMaps,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Nouvelle liste";
  const emptyNamePlaceholderS = "Observations, repérages, métrés, ...";
  const createEmptyS = "Créer";
  const presetTitleS = "Ajouter des listes pré-configurées";

  // data

  const appConfig = useAppConfig();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: scope } = useSelectedScope();
  const createListings = useCreateListings();
  const createListingsFromPresets = useCreateListingsFromPresetListingsKeys();

  // state

  const [emptyName, setEmptyName] = useState("");
  const [selectedKeys, setSelectedKeys] = useState([]);

  // helpers

  const defaultEntityModel = Object.values(
    appConfig?.entityModelsObject ?? {}
  ).find((em) => em.isDefault && em.type === "LOCATED_ENTITY");

  // handlers

  async function handleCreateEmpty() {
    if (!emptyName.trim()) return;
    const newListing = {
      name: emptyName.trim(),
      projectId,
      canCreateItem: true,
      table: defaultEntityModel?.defaultTable ?? "entities",
      entityModel: defaultEntityModel,
      entityModelKey: defaultEntityModel?.key,
      ...(isForBaseMaps && { isForBaseMaps: true }),
    };
    const [created] = await createListings({
      listings: [newListing],
      scope,
    });
    dispatch(setSelectedListingId(created.id));
    dispatch(setOpenedPanel("LISTING"));
    onClose?.(created);
  }

  async function handleAddPresets() {
    const listings = await createListingsFromPresets({
      presetListingsKeys: selectedKeys,
      scope,
      isForBaseMaps,
    });
    if (listings?.length > 0) {
      dispatch(setSelectedListingId(listings[0].id));
      dispatch(setOpenedPanel("LISTING"));
    }
    onClose?.();
  }

  // render

  return (
    <DialogGeneric open={open} onClose={onClose} maxWidth={false}>
      <Box sx={{ width: 700, display: "flex", flexDirection: "column" }}>
        {/* Section 1: Create empty list */}
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {titleS}
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
            <TextField
              size="small"
              fullWidth
              placeholder={emptyNamePlaceholderS}
              value={emptyName}
              onChange={(e) => setEmptyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateEmpty();
              }}
            />
            <Button
              variant="contained"
              color="secondary"
              disabled={!emptyName.trim()}
              onClick={handleCreateEmpty}
              sx={{ textTransform: "none", fontWeight: 600, flexShrink: 0 }}
            >
              {createEmptyS}
            </Button>
          </Box>
        </Box>

        <Divider />

        {/* Section 2: Add pre-configured lists */}
        <Box sx={{ p: 3, bgcolor: "background.default" }}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, mb: 2, color: "text.secondary" }}
          >
            {presetTitleS}
          </Typography>

          <Box sx={{ display: "flex", gap: 2, minHeight: 300 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <SectionPresetListingsSelector
                selectedKeys={selectedKeys}
                onChange={setSelectedKeys}
                isForBaseMaps={isForBaseMaps}
              />
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <SectionPresetListingsPreview
                selectedKeys={selectedKeys}
                onAddListings={handleAddPresets}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </DialogGeneric>
  );
}
