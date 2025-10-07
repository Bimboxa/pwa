import { useDispatch } from "react-redux";

import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import {
  setIsEditingEntity,
  setNewEntity,
} from "Features/entities/entitiesSlice";

import useCreateDefaultBlueprintsListing from "../hooks/useCreateDefaultBlueprintsListing";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import { setTempName } from "../blueprintsSlice";
import { setShowBgImageInMapEditor } from "Features/bgImage/bgImageSlice";

export default function ButtonCreateBlueprint() {
  const dispatch = useDispatch();

  // strings

  const appConfig = useAppConfig();
  const label =
    appConfig?.entityModelsObject?.blueprint?.strings?.labelNew ??
    "Nouveau plan";

  // data

  const createBlueprintsListing = useCreateDefaultBlueprintsListing();

  const { value: scope } = useSelectedScope();
  const baseMap = useMainBaseMap();

  // helper

  let defaultName = scope ? scope?.name + " • " + baseMap?.name : baseMap?.name;

  // handlers

  async function handleClick() {
    const listing = await createBlueprintsListing();
    console.log("new blueprints listing", listing);
    //
    dispatch(setSelectedListingId(listing?.id));
    dispatch(setIsEditingEntity(true));
    dispatch(setTempName(defaultName));
    //
    dispatch(setSelectedMenuItemKey("BLUEPRINT"));
    dispatch(setShowBgImageInMapEditor(true));
  }

  return (
    <ButtonGeneric
      label={label}
      onClick={handleClick}
      variant="contained"
      color="secondary"
    />
  );
}
