import { useSelector, useDispatch } from "react-redux";

import { setBgImageKey } from "Features/mapEditor/mapEditorSlice";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import SelectorBgImage from "Features/bgImage/components/SelectorBgImage";

export default function DialogSelectorBgImage({ open, onClose }) {
  const dispatch = useDispatch();

  // strings

  const title = "Choisir un gabarit";

  // data

  const selectedKey = useSelector((s) => s.mapEditor.bgImageKey);

  // handlers

  function handleChange(key) {
    dispatch(setBgImageKey(key));
  }

  return (
    <DialogGeneric title={title} open={open} onClose={onClose} width={300}>
      <SelectorBgImage selectedKey={selectedKey} onChange={handleChange} />
    </DialogGeneric>
  );
}
