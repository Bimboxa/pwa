import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useCreateListings from "Features/listings/hooks/useCreateListings";

// Create a new empty LOCATED_ENTITY listing by name and return the created
// listing. Mirrors DialogCreateListing.handleCreateEmpty (the canonical
// "Créer" path) so the new list is a normal annotations listing.
export default function useCreateListingForObjects() {
  const appConfig = useAppConfig();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: scope } = useSelectedScope();
  const createListings = useCreateListings();

  return async (name) => {
    const listingName = (name ?? "").trim() || "Nouvelle liste";

    const defaultEntityModel = Object.values(
      appConfig?.entityModelsObject ?? {}
    ).find((em) => em.isDefault && em.type === "LOCATED_ENTITY");

    const newListing = {
      name: listingName,
      projectId,
      canCreateItem: true,
      table: defaultEntityModel?.defaultTable ?? "entities",
      entityModel: defaultEntityModel,
      entityModelKey: defaultEntityModel?.key,
    };

    const created = await createListings({ listings: [newListing], scope });
    return created?.[0] ?? null;
  };
}
