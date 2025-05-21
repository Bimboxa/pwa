import {useSelector, useDispatch} from "react-redux";

import {setSelectedMapsListingId} from "Features/mapEditor/mapEditorSlice";

import SelectorVariantChips from "Features/layout/components/SelectorVariantChips";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";

export default function SelectorMapsListingVariantChips() {
  const dispatch = useDispatch();

  const {value: mapsListings} = useListingsByScope({mapsOnly: true});
  const id = useSelector((s) => s.mapEditor.selectedMapsListingId);

  const options = mapsListings?.map((listing) => ({
    key: listing.id,
    label: listing.name,
  }));

  const selection = id ? [id] : [];

  console.log("selection", selection);

  // handlers

  function handleChange(selection) {
    let id = null;
    if (selection?.length > 0) id = selection[0];
    dispatch(setSelectedMapsListingId(id));
  }

  return (
    <SelectorVariantChips
      options={options}
      selection={selection}
      onChange={handleChange}
    />
  );
}
