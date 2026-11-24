import { useMemo } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import sortAnnotationTemplatesByOrder from "Features/annotations/utils/sortAnnotationTemplatesByOrder";

const EMPTY = [];

// Annotation templates a photo of the reconstruction player can be created
// with: the IMAGE templates (« Objet 2D » symbols excluded) of the listings
// of the selected scope. Raw rows (no image hydration), each with the name
// of its listing: [{...template, listingName}].
export default function useReconstructionPhotoTemplates() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const templatesUpdatedAt = useSelector(
    (s) => s.annotations.annotationTemplatesUpdatedAt
  );
  const { value: listings } = useListingsByScope();

  // helpers

  const listingNameById = useMemo(() => {
    const map = new Map();
    (listings ?? []).forEach((listing) =>
      map.set(listing.id, listing.name ?? "")
    );
    return map;
  }, [listings]);

  const rows = useLiveQuery(async () => {
    if (!projectId) return EMPTY;
    const templates = await db.annotationTemplates
      .where("projectId")
      .equals(projectId)
      .toArray();
    return templates.filter(
      (template) =>
        !template.deletedAt &&
        !template.isObject2D &&
        resolveDrawingShape(template) === "IMAGE"
    );
  }, [projectId, templatesUpdatedAt]);

  return useMemo(() => {
    const inScope = (rows ?? EMPTY).filter((template) =>
      listingNameById.has(template.listingId)
    );
    return sortAnnotationTemplatesByOrder(inScope).map((template) => ({
      ...template,
      listingName: listingNameById.get(template.listingId),
    }));
  }, [rows, listingNameById]);
}
