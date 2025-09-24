import { useDispatch } from "react-redux";

import { setSelectedListingId } from "Features/listings/listingsSlice";
import {
  setIsEditingEntity,
  setNewEntity,
} from "Features/entities/entitiesSlice";

import useCreateDefaultBlueprintsListing from "../hooks/useCreateDefaultBlueprintsListing";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import { setTempName } from "../blueprintsSlice";

export default function ButtonCreateBlueprint() {
  const dispatch = useDispatch();

  // strings

  const label = "Créer un plan";

  // data

  const createBlueprintsListing = useCreateDefaultBlueprintsListing();

  const scope = useSelectedScope();
  const baseMap = useMainBaseMap();

  // helper

  const defaultName = scope.name + " • " + baseMap.name;

  // handlers

  async function handleClick() {
    const listing = await createBlueprintsListing();
    console.log("new blueprints listing", listing);
    //
    dispatch(setSelectedListingId(listing?.id));
    dispatch(setIsEditingEntity(true));
    dispatch(setTempName(defaultName));
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
