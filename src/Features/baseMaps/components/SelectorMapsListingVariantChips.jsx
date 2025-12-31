import { useSelector, useDispatch } from "react-redux";

import { setSelectedBaseMapsListingId } from "Features/mapEditor/mapEditorSlice";

import useProjectBaseMapListings from "../hooks/useProjectBaseMapListings";

import SelectorVariantChips from "Features/layout/components/SelectorVariantChips";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";

export default function SelectorMapsListingVariantChips() {
  const dispatch = useDispatch();

  const baseMapsListings = useProjectBaseMapListings();
  const id = useSelector((s) => s.mapEditor.selectedBaseMapsListingId);

  const options = baseMapsListings?.map((listing) => ({
    key: listing.id,
    label: listing.name,
  }));

  const selection = id ? [id] : [];

  // handlers

  function handleChange(selection) {
    let id = null;
    if (selection?.length > 0) id = selection[0];
    dispatch(setSelectedBaseMapsListingId(id));
  }

  return (
    <SelectorVariantChips
      options={options}
      selection={selection}
      onChange={handleChange}
      bgcolor="grey.800"
    />
  );
}
