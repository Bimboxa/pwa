import { useSelector, useDispatch } from "react-redux";

import { setSelectedBaseMapsListingId } from "Features/mapEditor/mapEditorSlice";

import useProjectBaseMapListings from "../hooks/useProjectBaseMapListings";

import SelectorVariantChips from "Features/layout/components/SelectorVariantChips";

// Pseudo listing key for the "Détails" chip (detail baseMaps belong to no
// listing — the selection is handled locally by the host selector).
const DETAILS_KEY = "__DETAILS__";

export default function SelectorMapsListingVariantChips({
  showDetailsOption = false,
  detailsSelected = false,
  onDetailsSelect,
}) {
  const dispatch = useDispatch();

  const baseMapsListings = useProjectBaseMapListings();
  const id = useSelector((s) => s.mapEditor.selectedBaseMapsListingId);

  const options = [
    ...(baseMapsListings?.map((listing) => ({
      key: listing.id,
      label: listing.name,
    })) ?? []),
    ...(showDetailsOption ? [{ key: DETAILS_KEY, label: "Détails" }] : []),
  ];

  const selection = detailsSelected ? [DETAILS_KEY] : id ? [id] : [];

  // handlers

  function handleChange(selection) {
    let key = null;
    if (selection?.length > 0) key = selection[0];
    if (key === DETAILS_KEY) {
      onDetailsSelect?.(true);
      return;
    }
    onDetailsSelect?.(false);
    dispatch(setSelectedBaseMapsListingId(key));
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
