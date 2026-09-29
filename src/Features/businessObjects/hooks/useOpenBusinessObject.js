import { useDispatch } from "react-redux";

import {
  setActiveBusinessObjectId,
  setSelectedListingId,
} from "../businessObjectsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

import useViewers from "Features/viewers/hooks/useViewers";
import useSwitchViewer from "Features/viewers/hooks/useSwitchViewer";

import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import { getBusinessObjectsModuleKey } from "../utils/businessObjectModuleKeys";

// Opens a business object from anywhere (e.g. the objects linked to a
// selected annotation): switches to the module of the object's type, makes
// its listing the module's active one, then activates and selects the object
// (properties in the right panel). The order matters: the module switch and
// the listing switch both reset the object focus and the selection.
export default function useOpenBusinessObject() {
  const dispatch = useDispatch();

  // strings

  const moduleDisabledS = "Le module de cet objet est désactivé";

  // data

  const viewers = useViewers();
  const switchViewer = useSwitchViewer();

  // main

  return async function openBusinessObject(businessObject) {
    if (!businessObject?.id) return;

    const listing = await db.listings.get(businessObject.listingId);
    const type = getBusinessObjectTypeOfListing(listing);
    const moduleKey = getBusinessObjectsModuleKey(type.key);

    if (!viewers.some((v) => v.key === moduleKey)) {
      dispatch(setToaster({ message: moduleDisabledS, isError: true }));
      return;
    }

    switchViewer(moduleKey);
    dispatch(setSelectedListingId(businessObject.listingId));
    dispatch(setActiveBusinessObjectId(businessObject.id));
    dispatch(
      setSelectedItem({
        id: businessObject.id,
        type: "BUSINESS_OBJECT",
        listingId: businessObject.listingId,
      })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  };
}
