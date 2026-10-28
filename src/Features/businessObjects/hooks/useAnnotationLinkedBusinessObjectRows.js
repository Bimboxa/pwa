import { useMemo } from "react";
import { useSelector } from "react-redux";

import useBusinessObjects from "./useBusinessObjects";
import useRelsBusinessObjectAnnotation from "./useRelsBusinessObjectAnnotation";

import buildBusinessObjectsTree, {
  getBusinessObjectsTreeDisplayMeta,
} from "../utils/buildBusinessObjectsTree";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import getBusinessObjectQtyLabel from "../utils/getBusinessObjectQtyLabel";
import { getQtyFormulasByTemplateId } from "../utils/qtyFormula";
import accumulateAnnotationQties, {
  createEmptyQties,
} from "../utils/accumulateAnnotationQties";
import { isTemplateLinked } from "../utils/linkedTemplateIds";
import { isAnnotationExcluded } from "../utils/excludedAnnotationIds";

const EMPTY = [];

// Business objects (types with quantities, every module) ONE annotation
// feeds — by rel or by its template's link, exclusions honoured —, as
// display rows for the map hover tooltip: [{id, number, label, qtyLabel}].
// `number` is the tree numbering of the listing (autoNumbering types) or
// the stored code; `qtyLabel` is the annotation's quantity in the object's
// unit (the object's formula for the template when defined, else the unit's
// default rule). `qties` are the annotation's quantities computed by the
// caller (the hovered annotation carries none). Returns EMPTY without link.
export default function useAnnotationLinkedBusinessObjectRows({
  annotation,
  qties,
} = {}) {
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const listingsById = useSelector((s) => s.listings.listingsById);

  const { value: scopeObjects } = useBusinessObjects({
    scopeId: annotation ? selectedScopeId : null,
  });
  const { value: rels } = useRelsBusinessObjectAnnotation({
    annotationId: annotation?.id,
  });

  return useMemo(() => {
    if (!annotation || !scopeObjects?.length) return EMPTY;
    const annotationWithQties = { ...annotation, qties };
    const relObjectIds = new Set((rels ?? []).map((r) => r.businessObjectId));

    // objects fed by the annotation, with their listing type
    const fed = scopeObjects.filter((o) => {
      const type = getBusinessObjectTypeOfListing(listingsById?.[o.listingId]);
      if (!type.features?.quantities) return false;
      if (relObjectIds.has(o.id)) return true;
      return (
        isTemplateLinked(o, annotation.annotationTemplateId) &&
        !isAnnotationExcluded(o, annotation.id)
      );
    });
    if (fed.length === 0) return EMPTY;

    // numbering per listing (tree numbering when the type auto-numbers)
    const numberById = {};
    [...new Set(fed.map((o) => o.listingId))].forEach((listingId) => {
      const type = getBusinessObjectTypeOfListing(listingsById?.[listingId]);
      const listingObjects = scopeObjects.filter(
        (o) => o.listingId === listingId
      );
      if (type.features?.autoNumbering) {
        const flat = buildBusinessObjectsTree(listingObjects);
        const meta = getBusinessObjectsTreeDisplayMeta(flat);
        flat.forEach(({ businessObject }, i) => {
          numberById[businessObject.id] = meta[i]?.number ?? null;
        });
      } else {
        listingObjects.forEach((o) => {
          numberById[o.id] = o.code || null;
        });
      }
    });

    return fed.map((businessObject) => {
      const stats = createEmptyQties();
      accumulateAnnotationQties(
        stats,
        annotationWithQties,
        getQtyFormulasByTemplateId(businessObject)
      );
      return {
        id: businessObject.id,
        number: numberById[businessObject.id] ?? null,
        label: businessObject.label ?? "",
        qtyLabel: getBusinessObjectQtyLabel(businessObject.unit, stats),
      };
    });
  }, [annotation, qties, scopeObjects, rels, listingsById]);
}
