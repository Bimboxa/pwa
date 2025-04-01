import DialogGeneric from "Features/layout/components/DialogGeneric";

import SectionScope from "./SectionScope";

export default function DialogCreateScope({project, open, onClose}) {
  // strings

  const newScopeS = "Nouveau lot";

  return (
    <DialogGeneric open={open} onClose={onClose} title={newScopeS}>
      <SectionScope
        newScopeProjectId={project?.id}
        forceNew={true}
        onSaved={onClose}
      />
    </DialogGeneric>
  );
}
