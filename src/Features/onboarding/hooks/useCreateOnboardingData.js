import { nanoid } from "@reduxjs/toolkit";

import { useSelector } from "react-redux";

import useCreateProject from "Features/projects/hooks/useCreateProject";
import useCreateListings from "Features/listings/hooks/useCreateListings";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";

export default function useCreateOnboardingData() {
  // data

  const projectName = useSelector((s) => s.onboarding.projectName);
  const mapName = useSelector((s) => s.onboarding.mapName);
  const mapFile = useSelector((s) => s.onboarding.fileName);
  const issuesListingName = useSelector((s) => s.onboarding.issuesListingName);

  // data - func

  const createProject = useCreateProject();
  const createListings = useCreateListings();
  const createEntity = useCreateEntity();

  // return

  return async () => {
    // project

    const _project = { id: nanoid(), name: projectName };
    const project = await createProject(_project);

    // return

    return {
      project,
    };
  };
}
