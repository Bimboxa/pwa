import { useSelector } from "react-redux";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function useHelperMessageInBottomBar() {
  // strings

  const defaultS = "[Click droit] Ajoutez un objet";
  const quitCreationModeS = "[ESC] Quittez le mode création";
  const selectedEntityS = "Sélection : [ESC] Quitter,  [DELETE] Supprimer";

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const selectedItem = useSelector((s) => s.selection.selectedItem);
  const { value: listing } = useSelectedListing()

  // helpers

  const emType = listing?.entityModel?.type;

  // return

  let string = "";

  if (enabledDrawingMode) {
    string = quitCreationModeS;
  } else if (selectedItem?.type === "ENTITY") {
    string = selectedEntityS;
  } else if (emType === "LOCATED_ENTITY") {
    //string = defaultS;
  }

  return string;
}
