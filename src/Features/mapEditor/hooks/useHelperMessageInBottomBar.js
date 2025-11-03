import { useSelector } from "react-redux";

export default function useHelperMessageInBottomBar() {
  // strings

  const defaultS = "[Click droit] Ajoutez un objet";
  const quitCreationModeS = "[ESC] Quittez le mode création";
  const selectedEntityS = "Sélection : [ESC] Quitter,  [DELETE] Supprimer";

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const selectedItem = useSelector((s) => s.selection.selectedItem);

  // return

  let string = defaultS;

  if (enabledDrawingMode) {
    string = quitCreationModeS;
  } else if (selectedItem?.type === "ENTITY") {
    string = selectedEntityS;
  }

  return string;
}
