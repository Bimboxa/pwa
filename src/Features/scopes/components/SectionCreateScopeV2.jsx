import { useState } from "react";

import { useDispatch } from "react-redux";
import { nanoid } from "nanoid";

import { useNavigate } from "react-router-dom";

import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useProjects from "Features/projects/hooks/useProjects";

import useCreateProject from "Features/projects/hooks/useCreateProject";
import useCreateScope from "../hooks/useCreateScope";

import { Autocomplete, Typography, TextField, Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import BoxFlexV from "Features/layout/components/BoxFlexV";

export default function SectionCreateScopeV2({ onClose, onCreated }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // strings

  const createS = "Créer";

  // data

  const appConfig = useAppConfig();
  const { value: projects } = useProjects();

  const createProject = useCreateProject();
  const createScope = useCreateScope();

  // state

  const [project, setProject] = useState(null);

  const [scopeName, setScopeName] = useState("");

  // helper

  const title = appConfig?.strings?.scope?.newScope ?? "Nouveau dossier";
  const label = appConfig?.strings?.project?.nameSingular ?? "Projet";
  const scopeNameLabel =
    appConfig?.strings?.scope?.nameLabel ?? "Nom du dossier";

  function handleNameChange(e) {
    setScopeName(e.target.value);
  }

  async function handleCreate() {
    console.log("project", project);
    if (!project || project?.length === 0 || scopeName?.length === 0) return;

    let scopeProject = project;
    if (!project?.id)
      scopeProject = await createProject({ name: project, id: nanoid() });

    const scope = await createScope({
      id: nanoid(),
      name: scopeName,
      projectId: scopeProject.id,
    });

    onCreated(scope);
  }

  // render

  return (
    <BoxFlexVStretch>
      <HeaderTitleClose title={title} onClose={onClose} />
      <BoxFlexV sx={{ p: 1, flexGrow: 1 }}>
        <Autocomplete
          freeSolo
          fullWidth
          onInputChange={(_, value) => setProject(value)}
          onChange={(_, value) => setProject(value)}
          options={projects ?? []}
          getOptionLabel={(option) => option.name}
          renderInput={(params) => (
            <TextField {...params} size="small" label={label} />
          )}
        />
        <Box sx={{ mt: 2 }}>
          <TextField
            size="small"
            fullWidth
            label={scopeNameLabel}
            value={scopeName}
            onChange={handleNameChange}
          />
        </Box>
      </BoxFlexV>

      <ButtonInPanelV2
        onClick={handleCreate}
        label={createS}
        variant="contained"
        color="secondary"
      />
    </BoxFlexVStretch>
  );
}
