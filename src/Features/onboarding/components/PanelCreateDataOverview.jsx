import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";

import useCreateOnboardingData from "../hooks/useCreateOnboardingData";

import { Button, Typography } from "@mui/material";

import Panel from "Features/layout/components/Panel";
import BoxCenter from "Features/layout/components/BoxCenter";
import { setSelectedProjectId } from "Features/projects/projectsSlice";

export default function PanelCreateDataOverview() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // string

  const createS = "Créer";

  // data

  const createOnboardingData = useCreateOnboardingData();

  // handlers

  async function handleCreate() {
    const { project } = await createOnboardingData();

    dispatch(setSelectedProjectId(project.id));

    navigate("/");
  }

  return (
    <Panel>
      <BoxCenter>
        <Button variant="contained" onClick={handleCreate}>
          <Typography>{createS}</Typography>
        </Button>
      </BoxCenter>
    </Panel>
  );
}
