import { useDispatch } from "react-redux";

import { setSelectedBaseMapsListingId } from "Features/mapEditor/mapEditorSlice";

import { generateKeyBetween } from "fractional-indexing";

import useCreateProject from "./useCreateProject";
import useCreateListings from "Features/listings/hooks/useCreateListings";
import useDefaultBaseMapsListingProps from "Features/baseMaps/hooks/useDefaultBaseMapsListingProps";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

// Creates a project (Dexie) with its default baseMaps listings
// ("Vues en plan" + "Coupes & élévations") and selects the plan listing.

export default function useCreateProjectWithDefaultListings() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const createProject = useCreateProject();
  const createListings = useCreateListings();
  const defaultProps = useDefaultBaseMapsListingProps();

  // free projects (created without a référentiel entity) still get a default
  // type from the config (e.g. "PROJECT" for edx); undefined → stays typeless
  const defaultProjectType = appConfig?.creation?.defaultProjectType;

  // main

  const create = async (projectProps) => {
    const project = await createProject({
      ...projectProps,
      type: projectProps?.type ?? defaultProjectType,
    });
    if (!project) return null;

    // rank (fractional indexing) keeps "Vues en plan" before "Coupes & élévations"
    const planRank = generateKeyBetween(null, null);
    const verticalRank = generateKeyBetween(planRank, null);
    const [planListing] = await createListings({
      listings: [
        {
          ...defaultProps,
          name: "Vues en plan",
          rank: planRank,
          projectId: project.id,
        },
        {
          ...defaultProps,
          name: "Coupes & élévations",
          verticalBaseMaps: true,
          rank: verticalRank,
          projectId: project.id,
        },
      ],
    });
    dispatch(setSelectedBaseMapsListingId(planListing?.id));

    return project;
  };

  return create;
}
