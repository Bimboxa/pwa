import { useState } from "react";

import { useDispatch } from "react-redux";

import { nanoid } from "nanoid";

import {
  setSelectedListingId,
  triggerBusinessObjectsUpdate,
} from "../businessObjectsSlice";

import useCreateBusinessObjectListing from "./useCreateBusinessObjectListing";
import createBusinessObjectsFromPromptIaService from "../services/createBusinessObjectsFromPromptIaService";
import buildPromptIaBusinessObjectRows from "../utils/buildPromptIaBusinessObjectRows";

// Creates a business-object listing and its objects from the items parsed
// out of a Prompt IA answer (parsePromptIaBusinessObjects), then selects the
// listing.
export default function useCreateListingFromPromptIa() {
  const dispatch = useDispatch();
  const createBusinessObjectListing = useCreateBusinessObjectListing();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const create = async ({ name, typeKey, canLocateBusinessObjects, items }) => {
    setBusy(true);
    setError(null);
    try {
      const listing = await createBusinessObjectListing({
        name,
        typeKey,
        canLocateBusinessObjects,
      });
      if (!listing) throw new Error("La liste n’a pas pu être créée.");

      const rows = buildPromptIaBusinessObjectRows({
        listing,
        items,
        newId: nanoid,
      });
      const count = await createBusinessObjectsFromPromptIaService({ rows });

      dispatch(triggerBusinessObjectsUpdate());
      dispatch(setSelectedListingId(listing.id));
      return { listing, count };
    } catch (err) {
      setError(err?.message ?? String(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  return { create, busy, error, clearError: () => setError(null) };
}
