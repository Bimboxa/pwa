import { useDispatch, useStore } from "react-redux";

import {
  setActiveBusinessObjectId,
  setSelectedListingId,
} from "Features/businessObjects/businessObjectsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import db from "App/db/db";

import useOpenBusinessObject from "Features/businessObjects/hooks/useOpenBusinessObject";
import getBusinessObjectTypeOfListing from "Features/businessObjects/utils/getBusinessObjectTypeOfListing";
import {
  getBusinessObjectsModuleKey,
  isBusinessObjectsModuleKey,
} from "Features/businessObjects/utils/businessObjectModuleKeys";

// Selects the business object of a highlight clicked in the PDF editor.
// The properties panel only routes to a business object inside a
// business-objects module, hence three cases:
// - another kind of module (the Viewer, whose drawer lists the objects
//   read-only): plain selection, like a row click there — no module switch;
// - the module of the object's type: active listing (only if it differs —
//   switching it resets the solo filter), active object, selection and the
//   properties panel;
// - another business-objects module: useOpenBusinessObject (module switch).
export default function useSelectBusinessObjectFromPdfEditor() {
  const dispatch = useDispatch();
  const store = useStore();
  const openBusinessObject = useOpenBusinessObject();

  return async function selectBusinessObject(businessObjectId) {
    if (!businessObjectId) return;
    const businessObject = await db.businessObjects.get(businessObjectId);
    if (!businessObject || businessObject.deletedAt) return;

    const selection = {
      id: businessObject.id,
      type: "BUSINESS_OBJECT",
      listingId: businessObject.listingId,
    };

    const state = store.getState();
    const moduleKey = state.viewers.selectedViewerKey;
    if (!isBusinessObjectsModuleKey(moduleKey)) {
      dispatch(setSelectedItem(selection));
      return;
    }

    const listing = await db.listings.get(businessObject.listingId);
    const objectModuleKey = getBusinessObjectsModuleKey(
      getBusinessObjectTypeOfListing(listing).key
    );
    if (objectModuleKey !== moduleKey) {
      await openBusinessObject(businessObject);
      return;
    }

    if (state.businessObjects.selectedListingId !== businessObject.listingId) {
      dispatch(setSelectedListingId(businessObject.listingId));
    }
    dispatch(setActiveBusinessObjectId(businessObject.id));
    dispatch(setSelectedItem(selection));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  };
}
