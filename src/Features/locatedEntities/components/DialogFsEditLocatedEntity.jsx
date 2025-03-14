import DialogFs from "Features/layout/components/DialogFs";
import FormLocatedEntity from "./FormLocatedEntity";

export default function DialogFsEditLocatedEntity({open, onClose}) {
  // data

  return (
    <DialogFs open={open} onClose={onClose}>
      <FormLocatedEntity />
    </DialogFs>
  );
}
