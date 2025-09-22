import { useState, useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setScopeName } from "Features/onboarding/onboardingSlice";
import { setSelectedScopeId } from "../scopesSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useCreateScope from "../hooks/useCreateScope";

import { Box, Typography, TextField } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import SectionSelectorPresetScope from "./SectionSelectorPresetScope";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import useScopes from "../hooks/useScopes";
import ListItemsGeneric from "Features/layout/components/ListItemsGeneric";

export default function DialogOnboardingScopeName({ open, onClose }) {
  const dispatch = useDispatch();

  // strings

  const helperS = "Quel type de plan de repérage souhaitez vous réaliser ? ";
  const examplesS = "Exemples :";
  const saveS = "Enregistrer";
  const placeholder = "Type de plan";
  const existingScopesS = "Krtos existants sur le projet";

  // data

  const appConfig = useAppConfig();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: scopes } = useScopes({ filterByProjectId: projectId });

  // data - func

  const createScope = useCreateScope();

  // state

  const [name, setName] = useState("");
  const [presetScopeKey, setPresetScopeKey] = useState(null);

  useEffect(() => {
    if (presetScopeKey) {
      setName(appConfig.presetScopesObject[presetScopeKey]?.name);
    }
  }, [Boolean(appConfig), presetScopeKey]);

  // handlers

  function handleClose() {
    setName("");
    onClose();
  }

  async function handleSave() {
    const scope = await createScope({ name });
    dispatch(setSelectedScopeId(scope?.id));
    onClose();
  }

  function handleScopeClick(scope) {
    dispatch(setSelectedScopeId(scope.id));
    onClose();
  }

  // render

  return (
    <DialogGeneric open={open} onClose={handleClose} width={"300px"}>
      <BoxFlexVStretch>
        <Box sx={{ p: 3 }}>
          <Typography>{helperS}</Typography>
        </Box>

        <Box sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary">
            {examplesS}
          </Typography>
          <SectionSelectorPresetScope
            presetScopeKey={presetScopeKey}
            onChange={setPresetScopeKey}
          />
        </Box>

        <TextField
          placeholder={placeholder}
          size="small"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ p: 1 }}
        />
        <Box sx={{ display: "flex", width: 1, justifyContent: "end", p: 1 }}>
          <ButtonGeneric
            label={saveS}
            onClick={handleSave}
            variant="contained"
            disabled={!name}
          />
        </Box>

        <BoxFlexVStretch
          sx={{ bgcolor: "background.default", borderRadius: 1, mt: 2 }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
            {existingScopesS}
          </Typography>
          <Box sx={{ width: 1, flexGrow: 1, overflow: "auto" }}>
            <Box sx={{ width: 1, bgcolor: "white" }}>
              <ListItemsGeneric
                items={scopes}
                onClick={handleScopeClick}
                labelKey="name"
              />
            </Box>
          </Box>
        </BoxFlexVStretch>
      </BoxFlexVStretch>
    </DialogGeneric>
  );
}
