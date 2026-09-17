import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useCreateListings from "Features/listings/hooks/useCreateListings";
import getDefaultLocatedEntityModel from "Features/listings/utils/getDefaultLocatedEntityModel";

// Create a new empty LOCATED_ENTITY listing (annotations list) by name in the
// selected scope and return it. Mirrors DialogCreateListing.handleCreateEmpty
// (the canonical "Créer" path) so the new list is a normal annotations
// listing. `props` are extra fields stored on the listing row (e.g.
// `relayJobId` for a list created by the ChatGPT relay). The selection is
// left to the caller.
export default function useCreateAnnotationListing() {
  const appConfig = useAppConfig();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: scope } = useSelectedScope();
  const createListings = useCreateListings();

  return async ({ name, props } = {}) => {
    const listingName = (name ?? "").trim() || "Nouvelle liste";

    const defaultEntityModel = getDefaultLocatedEntityModel(appConfig);

    const newListing = {
      name: listingName,
      projectId,
      canCreateItem: true,
      table: defaultEntityModel?.defaultTable ?? "entities",
      ...(defaultEntityModel && {
        entityModel: defaultEntityModel,
        entityModelKey: defaultEntityModel.key,
      }),
      ...(props ?? {}),
    };

    const created = await createListings({ listings: [newListing], scope });
    return created?.[0] ?? null;
  };
}
