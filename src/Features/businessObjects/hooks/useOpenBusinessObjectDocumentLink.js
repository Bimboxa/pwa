import { useDispatch } from "react-redux";

import { setActiveBusinessObjectId } from "../businessObjectsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setToaster } from "Features/layout/layoutSlice";

import resolveResourceOfRelService from "Features/resources/services/resolveResourceOfRelService";
import useOpenResourceRel from "Features/pdfEditor/hooks/useOpenResourceRel";

// Opens the document of a db.relsBusinessObjectResource row: a PDF in the
// PDF editor layer, at the page and highlighted zone of the link (page 1 for
// a whole-resource link); any other file in the RESOURCES panel (see
// useOpenResourceRel). The business object is selected first: the properties
// panel and the "Lier à" target of the viewer follow it.
export default function useOpenBusinessObjectDocumentLink() {
  const dispatch = useDispatch();
  const openResourceRel = useOpenResourceRel();

  // strings

  const missingS = "Document introuvable dans les ressources";

  // main

  return async function openBusinessObjectDocumentLink(businessObject, rel) {
    if (!businessObject || !rel) return;

    const resource = await resolveResourceOfRelService(rel);
    if (!resource) {
      dispatch(setToaster({ message: missingS, isError: true }));
      return;
    }

    dispatch(setActiveBusinessObjectId(businessObject.id));
    dispatch(
      setSelectedItem({
        id: businessObject.id,
        type: "BUSINESS_OBJECT",
        listingId: businessObject.listingId,
      })
    );
    openResourceRel(rel, resource);
  };
}
