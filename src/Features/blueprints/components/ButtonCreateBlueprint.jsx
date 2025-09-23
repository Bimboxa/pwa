import { useDispatch } from "react-redux";

import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setIsEditingEntity } from "Features/entities/entitiesSlice";

import useCreateDefaultBlueprintsListing from "../hooks/useCreateDefaultBlueprintsListing";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function ButtonCreateBlueprint() {
  const dispatch = useDispatch();

  // strings

  const label = "Créer un export";

  // data

  const createBlueprintsListing = useCreateDefaultBlueprintsListing();

  // handlers

  async function handleClick() {
    const listing = await createBlueprintsListing();
    console.log("new blueprints listing", listing);
    //
    dispatch(setSelectedListingId(listing?.id));
    dispatch(setIsEditingEntity(true));
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
