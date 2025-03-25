import {Dialog, DialogTitle} from "@mui/material";

import SectionScope from "./SectionScope";

export default function DialogCreateScope({open, onClose}) {
  // strings

  const newScopeS = "Nouveau lot";

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{newScopeS}</DialogTitle>
      <SectionScope forceNew={true} />
    </Dialog>
  );
}
