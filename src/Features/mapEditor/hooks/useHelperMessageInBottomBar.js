import { useSelector } from "react-redux";

export default function useHelperMessageInBottomBar() {
  // strings

  const quitCreationModeS = "[ESC] Quittez le mode création";

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // return

  let string = "";

  if (enabledDrawingMode) string = quitCreationModeS;

  return string;
}
