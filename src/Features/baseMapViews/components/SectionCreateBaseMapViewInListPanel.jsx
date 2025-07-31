import { useSelector, useDispatch } from "react-redux";

import { setEditedBaseMapView } from "../baseMapViewsSlice";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import FormBaseMapViewVariantCreate from "./FormBaseMapViewVariantCreate";

export default function SectionCreateBaseMapViewInListPanel() {
  const dispatch = useDispatch();

  // data

  const baseMaps = useBaseMaps();

  const editedBaseMapView = useSelector(
    (s) => s.baseMapViews.editedBaseMapView
  );

  // handlers

  function handleChange(newBaseMapView) {
    dispatch(setEditedBaseMapView(newBaseMapView));
  }

  // return
  <FormBaseMapViewVariantCreate
    baseMapView={editedBaseMapView}
    onChange={handleChange}
    baseMaps={baseMaps}
  />;
}
