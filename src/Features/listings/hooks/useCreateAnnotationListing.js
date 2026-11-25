import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useCreateListings from "Features/listings/hooks/useCreateListings";
import getDefaultLocatedEntityModel from "Features/listings/utils/getDefaultLocatedEntityModel";
import getSelectScopeRequiredMessage from "Features/scopes/utils/getSelectScopeRequiredMessage";

// Create a new empty LOCATED_ENTITY listing (annotations list) by name in the
// selected scope and return it. Mirrors DialogCreateListing.handleCreateEmpty
// (the canonical "Créer" path) so the new list is a normal annotations
// listing. `props` are extra fields stored on the listing row (e.g.
// `relayJobId` for a list created by the ChatGPT relay). The selection is
// left to the caller.
export default function useCreateAnnotationListing() {
  const dispatch = useDispatch();
  const appConfig = useAppConfig();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: scope } = useSelectedScope();
  const createListings = useCreateListings();

  return async ({ name, props } = {}) => {
    // An annotations list always belongs to a scope: without one it would be
    // created with no scopeId and show up nowhere.
    if (!scope?.id) {
      dispatch(
        setToaster({
          message: getSelectScopeRequiredMessage(appConfig),
          isError: true,
        })
      );
      return null;
    }

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
