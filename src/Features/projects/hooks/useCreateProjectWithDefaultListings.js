import { useDispatch } from "react-redux";

import { setSelectedBaseMapsListingId } from "Features/mapEditor/mapEditorSlice";

import { generateKeyBetween } from "fractional-indexing";

import useCreateProject from "./useCreateProject";
import useCreateListings from "Features/listings/hooks/useCreateListings";
import useDefaultBaseMapsListingProps from "Features/baseMaps/hooks/useDefaultBaseMapsListingProps";

// Creates a project (Dexie) with its default baseMaps listings
// ("Vues en plan" + "Coupes & élévations") and selects the plan listing.

export default function useCreateProjectWithDefaultListings() {
  const dispatch = useDispatch();

  // data

  const createProject = useCreateProject();
  const createListings = useCreateListings();
  const defaultProps = useDefaultBaseMapsListingProps();

  // main

  const create = async (projectProps) => {
    const project = await createProject(projectProps);
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
