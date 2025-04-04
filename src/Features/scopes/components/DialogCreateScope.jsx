import DialogGeneric from "Features/layout/components/DialogGeneric";

import SectionScope from "./SectionScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function DialogCreateScope({project, open, onClose}) {
  const appConfig = useAppConfig();

  // strings

  const newScopeS = appConfig?.strings?.scope?.new;

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
