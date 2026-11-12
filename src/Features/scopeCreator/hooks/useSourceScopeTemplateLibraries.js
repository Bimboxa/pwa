import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import sortAnnotationTemplatesByOrder from "Features/annotations/utils/sortAnnotationTemplatesByOrder";
import { getSourceScopeListings } from "../services/applySourceScopeService";

const EMPTY = [];

// Templates preview of the « Krto source » choice: one "library"
// `{ key, name, templates }` per ticked listing of the source scope
// (`sourceScope.listingIds` null = every listing), read from the local db.
// Empty while the source scope is not installed on this device.

export default function useSourceScopeTemplateLibraries(sourceScope) {
  // data

  const appConfig = useAppConfig();

  const sourceScopeId = sourceScope?.scopeId ?? null;
  const listingIds = sourceScope?.listingIds ?? null;
  const listingIdsKey = listingIds ? listingIds.join(",") : "ALL";

  const libraries = useLiveQuery(async () => {
    if (!sourceScopeId) return EMPTY;

    const sourceListings = await getSourceScopeListings({
      sourceScopeId,
      appConfig,
    });
    const listings = sourceListings
      .filter((l) => !listingIds || listingIds.includes(l.id))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    if (listings.length === 0) return EMPTY;

    const templates = await db.annotationTemplates
      .where("listingId")
      .anyOf(listings.map((l) => l.id))
      .toArray();

    return listings.map((listing) => ({
      key: listing.id,
      name: listing.name ?? listing.label ?? "Liste",
      // same order as the Dessin panel
      templates: sortAnnotationTemplatesByOrder(
        templates.filter((t) => t.listingId === listing.id && !t.deletedAt)
      ),
    }));
  }, [sourceScopeId, listingIdsKey, Boolean(appConfig)]);

  return libraries ?? EMPTY;
}
