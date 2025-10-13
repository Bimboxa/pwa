import { useDispatch } from "react-redux";

import { setOpenedPanel } from "Features/listings/listingsSlice";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function ButtonShowListingAnnotationTemplatesInLeftPanel() {
  const dispatch = useDispatch();

  // strings

  const openS = "Voir la bibliothèque d'annotations";

  // handlers

  function handleClick() {
    dispatch(setOpenedPanel("LISTING_ANNOTATION_TEMPLATES"));
  }

  // render

  return <ButtonGeneric label={openS} onClick={handleClick} />;
}
