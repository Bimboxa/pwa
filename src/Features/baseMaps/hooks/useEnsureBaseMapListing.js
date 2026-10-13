import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedBaseMapsListingId,
  setNewBaseMapListingName,
} from "Features/mapEditor/mapEditorSlice";

import useProjectBaseMapListings from "./useProjectBaseMapListings";
import useDefaultBaseMapsListingProps from "./useDefaultBaseMapsListingProps";
import useCreateBaseMapListing from "Features/baseMapEditor/hooks/useCreateBaseMapListing";

const FALLBACK_LISTING_NAME = "Fonds de plan";

/**
 * Resolves the base map listing a new base map goes into, creating it when
 * the project has none yet.
 *
 * Resolution order: the explicit listing → the first project listing → a new
 * listing named after s.mapEditor.newBaseMapListingName (typed in the
 * create-base-map section), else the entity model's default listing name.
 * The created listing becomes the selected base maps listing.
 *
 * @returns async ({ listing? }) => listing | null (no selected project)
 */
export default function useEnsureBaseMapListing() {
  const dispatch = useDispatch();

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const newListingName = useSelector((s) => s.mapEditor.newBaseMapListingName);
  const listings = useProjectBaseMapListings();
  const defaultProps = useDefaultBaseMapsListingProps();
  const createBaseMapListing = useCreateBaseMapListing();

  return async function ensureBaseMapListing({ listing } = {}) {
    if (listing?.id) return listing;
    if (listings?.[0]) return listings[0];
    if (!projectId) return null;

    const title =
      (newListingName ?? "").trim() ||
      defaultProps.name ||
      FALLBACK_LISTING_NAME;

    const created = await createBaseMapListing({ projectId, title });

    dispatch(setSelectedBaseMapsListingId(created.id));
    dispatch(setNewBaseMapListingName(null));

    return created;
  };
}
