import {Dialog} from "@mui/material";
import SectionSettings from "./SectionSettings";

export default function DialogSettings({open, onClose}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <SectionSettings />
    </Dialog>
  );
}
