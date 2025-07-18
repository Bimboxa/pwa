import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";

import useCreateOnboardingData from "../hooks/useCreateOnboardingData";

import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";

import { Button, Typography } from "@mui/material";

import Panel from "Features/layout/components/Panel";
import BoxCenter from "Features/layout/components/BoxCenter";
import { setLoadedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

export default function PanelCreateDataOverview() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // string

  const createS = "Créer";

  // data

  const createOnboardingData = useCreateOnboardingData();

  // handlers

  async function handleCreate() {
    try {
      const { project, issuesListing, map } = await createOnboardingData();
      console.log("[success]", project, issuesListing, map);

      dispatch(setSelectedProjectId(project.id));
      dispatch(setSelectedListingId(issuesListing?.id));
      dispatch(setLoadedMainBaseMapId(map?.id));

      navigate("/");
    } catch (e) {
      console.error("error", e);
    }
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
