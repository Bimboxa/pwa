import { useSelector } from "react-redux";

import useCreateAnnotationTemplatesFromLibrary from "Features/annotations/hooks/useCreateAnnotationTemplatesFromLibrary";

import findObjectTemplateInListing from "../services/findObjectTemplateInListing";

// Deterministic library-model id for a système template, so re-creating the
// system into the same listing reuses the existing rows instead of
// duplicating them (dedup is by modelIdMaster via findObjectTemplateInListing,
// like the 2D flow).
export function getSystemTemplateModelId(object, template) {
  const base = object?.modelIdMaster ?? object?.id ?? "system";
  const slot =
    template?.mappingCategories?.[0] ?? template?.label ?? "TEMPLATE";
  return `${base}:${slot}`;
}

// Make sure every template of a "Système" (source and / or generated ones,
// with the user's dialog edits) exists in the target listing: the ones the
// listing already holds (modelIdMaster match) are kept as is, the missing
// ones are created in one bulk insert. Returns the number of created rows.
//
// Shared by the library "Dessiner" flow (usePlaceSystemFromLibrary) and the
// "Associer un système à l'axe" flow (DialogAssociateSystemToAxis), which
// both need the generated templates in place before the procedure runs.
export default function useEnsureSystemTemplatesInListing() {
  const createTemplatesFromLibrary = useCreateAnnotationTemplatesFromLibrary();
  const selectedProjectId = useSelector((s) => s.projects.selectedProjectId);

  return async ({ object, templates, listingId }) => {
    if (!object || !listingId) return 0;
    const toCreate = [];
    for (const t of templates ?? []) {
      const template = {
        ...t,
        modelIdMaster: getSystemTemplateModelId(object, t),
      };
      const existing = await findObjectTemplateInListing(
        listingId,
        template.modelIdMaster
      );
      if (!existing) toCreate.push(template);
    }
    if (toCreate.length > 0) {
      await createTemplatesFromLibrary(toCreate, {
        listingId,
        projectId: selectedProjectId,
      });
    }
    return toCreate.length;
  };
}
