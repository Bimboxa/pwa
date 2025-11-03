import { useSelector, useDispatch } from "react-redux";

import { setOpenDialogAutoSelectAnnotationTemplateToCreateEntity } from "Features/mapEditor/mapEditorSlice";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import SectionSelectAnnotationTemplateToCreateEntity from "./SectionSelectAnnotationTemplateToCreateEntity";

export default function DialogAutoSelectAnnotationTemplateToCreateEntity({}) {
  const dispatch = useDispatch();

  // data

  const open = useSelector(
    (s) => s.mapEditor.openDialogAutoSelectAnnotationTemplateToCreateEntity
  );

  // handlers

  function handleClose() {
    dispatch(setOpenDialogAutoSelectAnnotationTemplateToCreateEntity(false));
  }

  return (
    <DialogGeneric open={open} onClose={handleClose} width="300px">
      <SectionSelectAnnotationTemplateToCreateEntity onSelected={handleClose} />
    </DialogGeneric>
  );
}
