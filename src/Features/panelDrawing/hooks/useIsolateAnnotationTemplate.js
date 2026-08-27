import { useSelector, useDispatch } from "react-redux";

import { setHiddenListingsIds } from "Features/listings/listingsSlice";
import { setSoloAnnotationTemplateId } from "Features/annotations/annotationsSlice";

import useListings from "Features/listings/hooks/useListings";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useUpdateAnnotationTemplates from "Features/annotations/hooks/useUpdateAnnotationTemplates";

// ---------------------------------------------------------------------------
// useIsolateAnnotationTemplate — "Isoler" as a plain bulk visibility action:
// hide every other listing of the panel (redux hiddenListingsIds) and every
// sibling template of the same listing (persisted `hidden` flag), instead of
// the transient solo render filter. Second call restores everything.
// ---------------------------------------------------------------------------

export default function useIsolateAnnotationTemplate(template) {
  const dispatch = useDispatch();

  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );

  // Same query as PanelDrawing: the "other listings" set matches the panel
  // in both hosts (Dessin panel and Viewer annotations panel).
  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  const siblingTemplates = useAnnotationTemplates({
    filterByListingId: template?.listingId,
  });

  const updateAnnotationTemplates = useUpdateAnnotationTemplates();

  // helpers

  const panelListingsIds = (listings ?? []).map((l) => l.id);
  const otherListingsIds = panelListingsIds.filter(
    (id) => id !== template?.listingId
  );
  const otherTemplates = (siblingTemplates ?? []).filter(
    (t) => t.id !== template?.id
  );

  const isIsolated = Boolean(
    template &&
    !template.hidden &&
    otherTemplates.every((t) => t.hidden) &&
    otherListingsIds.every((id) => hiddenListingsIds.includes(id))
  );

  // handlers

  const toggleIsolation = async () => {
    if (!template) return;

    // Hidden listing ids from other scopes are preserved either way.
    const keptHiddenIds = hiddenListingsIds.filter(
      (id) => !panelListingsIds.includes(id)
    );

    if (isIsolated) {
      // Un-isolate: re-show the panel's listings and all the templates of
      // the isolated one's listing (other listings keep their own flags).
      dispatch(setHiddenListingsIds(keptHiddenIds));
      await updateAnnotationTemplates(
        (siblingTemplates ?? [])
          .filter((t) => t.hidden)
          .map((t) => ({ id: t.id, hidden: false }))
      );
      return;
    }

    // Isolate. Clear the legacy solo filter so it doesn't stack on top of
    // the hidden-based isolation.
    dispatch(setSoloAnnotationTemplateId(null));
    dispatch(setHiddenListingsIds([...keptHiddenIds, ...otherListingsIds]));
    const updates = [
      ...otherTemplates
        .filter((t) => !t.hidden)
        .map((t) => ({ id: t.id, hidden: true })),
      ...(template.hidden ? [{ id: template.id, hidden: false }] : []),
    ];
    await updateAnnotationTemplates(updates);
  };

  return { isIsolated, toggleIsolation };
}
