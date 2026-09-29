import { useDispatch } from "react-redux";

import { setActiveBusinessObjectId } from "../businessObjectsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import {
  openResourceAtPage,
  setSelectedResourceId,
} from "Features/resources/resourcesSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { setToaster } from "Features/layout/layoutSlice";

import resolveResourceOfRelService from "Features/resources/services/resolveResourceOfRelService";
import isWholeResourceRel from "../utils/isWholeResourceRel";

// Opens the RESOURCES panel on the document, page and highlighted zone of a
// db.relsBusinessObjectResource row (a whole-resource link just opens the
// resource: no page target). The business object is selected first: the
// viewer only shows the highlights of the selected object.
export default function useOpenBusinessObjectDocumentLink() {
  const dispatch = useDispatch();

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
    if (isWholeResourceRel(rel)) {
      dispatch(setSelectedResourceId(resource.id));
    } else {
      dispatch(
        openResourceAtPage({
          resourceId: resource.id,
          pageNumber: rel.pageNumber,
          highlightId: rel.id,
        })
      );
    }
    dispatch(setSelectedMenuItemKey("RESOURCES"));
  };
}
