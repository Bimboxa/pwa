import { useDispatch, useSelector } from "react-redux";

import { setSelectedPresetScopeKey, setStepKey } from "../scopeCreatorSlice";

import usePresetScopes from "../hooks/usePresetScopes";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Typography, ListItemButton, Divider } from "@mui/material";
import { NoteAdd as CreateIcon } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ListItemsGeneric from "Features/layout/components/ListItemsGeneric";

import SectionLoadRemoteScope from "./SectionLoadRemoteScope";

export default function SectionSelectPresetScope() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  const presetScopes = usePresetScopes();
  const selectedPresetScopeKey = useSelector(
    (s) => s.scopeCreator.selectedPresetScopeKey
  );

  // helpers

  const scopeS = appConfig?.strings?.scope?.nameSingular ?? "Dossier";

  const items = presetScopes?.map((ps) => ({
    ...ps,
    label: ps.name,
    id: ps.key,
  }));

  // handlers

  function handlePresetClick(preset) {
    dispatch(
      setSelectedPresetScopeKey(
        preset.key === selectedPresetScopeKey ? null : preset.key
      )
    );
    dispatch(setStepKey("CREATE_SCOPE"));
  }

  function handleNoPresetClick() {
    dispatch(setSelectedPresetScopeKey(null));
    dispatch(setStepKey("CREATE_SCOPE"));
  }

  return (
    <BoxFlexVStretch>
      {/* Section 1 — Charger un scope distant */}
      <SectionLoadRemoteScope />

      <Divider sx={{ my: 1 }} />

      {/* Section 2 — Créer un nouveau scope */}
      <Box>
        <Box sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          pt: 1,
          pb: 1,
        }}>
          <CreateIcon sx={{ fontSize: 18, color: "text.secondary" }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Créer un nouveau {scopeS.toLowerCase()}
          </Typography>
        </Box>

        <ListItemsGeneric
          items={items}
          onClick={handlePresetClick}
          keyString="key"
        />
        <ListItemButton onClick={handleNoPresetClick} divider>
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
            Aucun modèle
          </Typography>
        </ListItemButton>
      </Box>
    </BoxFlexVStretch>
  );
}
