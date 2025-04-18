import DialogGeneric from "Features/layout/components/DialogGeneric";

import SectionScope from "./SectionScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useCreateRemoteScopeFile from "../hooks/useCreateRemoteScopeFile";

export default function DialogCreateScope({project, open, onClose, onCreated}) {
  console.log("[DialogCreateScope] project", project);
  const appConfig = useAppConfig();

  // strings

  const newScopeS = appConfig?.strings?.scope?.new;

  // data

  //const createRemoteScopeFile = useCreateRemoteScopeFile();

  // handlers

  async function handleSaved(scope) {
    console.log("[DialogCreateScope] new scope saved", scope);
    // if (createRemote) {
    //   const file = await createRemoteScopeFile({scope, project});
    //   console.log("[DialogCreateScope] file created", file);
    // }
    if (onCreated) onCreated(scope);
    onClose();
  }

  return (
    <DialogGeneric open={open} onClose={onClose} title={newScopeS}>
      <SectionScope
        newScopeProjectId={project?.id}
        forceNew={true}
        onSaved={handleSaved}
      />
    </DialogGeneric>
  );
}
