import { useEffect } from "react";
import { useDispatch } from "react-redux";

import { setBaseMapsGridScopeSheets } from "Features/baseMapsGrid/baseMapsGridSlice";

import useScopeGridSheets from "../hooks/useScopeGridSheets";

// Renders nothing: mirrors the sheets of the pinned base maps grid
// (useScopeGridSheets) into redux (baseMapsGrid.scopeSheets), where the 2D
// layer, the 3D grid and the 3D annotations loader read them — one query
// for the three consumers. Mounted while the SCOPE module is selected.
export default function ScopeGridSheetsController() {
  const dispatch = useDispatch();

  const { baseMapIds, addListingId, ready } = useScopeGridSheets();
  const idsKey = baseMapIds.join(",");

  useEffect(() => {
    dispatch(
      setBaseMapsGridScopeSheets({
        baseMapIds: idsKey ? idsKey.split(",") : [],
        addListingId,
        ready,
      })
    );
  }, [idsKey, addListingId, ready, dispatch]);

  useEffect(
    () => () => {
      dispatch(setBaseMapsGridScopeSheets(null));
    },
    [dispatch]
  );

  return null;
}
