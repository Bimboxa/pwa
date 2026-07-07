import { useDispatch } from "react-redux";

import { triggerAnnotationTemplatesUpdate } from "../annotationsSlice";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useDeleteListing from "Features/listings/hooks/useDeleteListing";

import db from "App/db/db";
import { OwnershipError } from "App/db/ownership";

/**
 * Cleanup helper for the listings properties panel.
 *
 * `computeUnused()` (non-reactive, direct DB) returns the annotationTemplates in
 * the current scope that are referenced by 0 annotation, plus the LOCATED_ENTITY
 * listings that would end up with no template once those are removed.
 *
 * `deleteUnused(candidates)` soft-deletes the templates then the now-empty
 * listings. Listings the current user cannot edit (ownership) are skipped
 * silently.
 */
export default function useDeleteUnusedAnnotationTemplates() {
  const dispatch = useDispatch();

  // the scope's LOCATED_ENTITY listings (resolved entityModel, non free-annotations)
  const { value: scopeListings } = useListingsByScope({
    filterByEntityModelType: "LOCATED_ENTITY",
  });
  const deleteListing = useDeleteListing();

  async function computeUnused() {
    const listings = (scopeListings ?? []).filter(
      (l) => !l.isFreeAnnotationsListing
    );
    const scopeListingIds = listings.map((l) => l.id);
    if (scopeListingIds.length === 0) {
      return {
        unusedTemplateIds: [],
        emptyListingIds: [],
        templateCount: 0,
        listingCount: 0,
      };
    }

    // annotations referencing a template, within the scope's listings
    const annotations = await db.annotations
      .where("listingId")
      .anyOf(scopeListingIds)
      .filter((a) => !a.deletedAt)
      .toArray();
    const usedTemplateIds = new Set(
      annotations.map((a) => a.annotationTemplateId)
    );

    // all templates in the scope's listings
    const templates = await db.annotationTemplates
      .where("listingId")
      .anyOf(scopeListingIds)
      .filter((t) => !t.deletedAt)
      .toArray();

    const unusedTemplateIds = templates
      .filter((t) => !usedTemplateIds.has(t.id))
      .map((t) => t.id);
    const unusedSet = new Set(unusedTemplateIds);

    // a listing becomes empty when it had at least one template and all of them
    // are unused → delete it too
    const emptyListingIds = listings
      .filter((l) => {
        const listingTemplates = templates.filter((t) => t.listingId === l.id);
        return (
          listingTemplates.length > 0 &&
          listingTemplates.every((t) => unusedSet.has(t.id))
        );
      })
      .map((l) => l.id);

    return {
      unusedTemplateIds,
      emptyListingIds,
      templateCount: unusedTemplateIds.length,
      listingCount: emptyListingIds.length,
    };
  }

  async function deleteUnused({ unusedTemplateIds, emptyListingIds }) {
    if (unusedTemplateIds?.length) {
      await db.annotationTemplates.bulkDelete(unusedTemplateIds);
      dispatch(triggerAnnotationTemplatesUpdate());
    }

    for (const listingId of emptyListingIds ?? []) {
      try {
        await deleteListing(listingId);
      } catch (e) {
        // skip listings owned by another user
        if (!(e instanceof OwnershipError)) throw e;
      }
    }
  }

  return { computeUnused, deleteUnused };
}
