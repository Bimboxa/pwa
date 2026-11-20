import { useSelector } from "react-redux";

import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";
import isCommandsToolbarModuleKey from "Features/commandsToolbar/utils/isCommandsToolbarModuleKey";
import { selectDisabledModuleKeys } from "Features/scopeConfig/utils/scopeConfigSelectors";

import { COMMENTS_MODULE_KEY } from "../constants/commentEntityModel";

// Infos are written from the Infos module and, while that module is enabled
// in the scope, from every other module but the Viewer (buttons of the infos
// strip, "add an info" commands of the toolbar); in the Viewer module, a
// shared `?mode=viewer` link or a read-only scope they are read.
// `canLocate`: the module displays the shared 2D / 3D editors, where the
// location of a located info is picked.
export default function useCanEditComments() {
  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  const viewerMode = useSelector((s) => s.urlParams.viewerMode);
  const commentsModuleEnabled = useSelector(
    (s) => !selectDisabledModuleKeys(s).includes(COMMENTS_MODULE_KEY)
  );
  const { isReadOnly } = useReadOnlyScope();

  const isWritingModule =
    moduleKey === COMMENTS_MODULE_KEY ||
    (commentsModuleEnabled && moduleKey !== "THREED");
  const canEdit = isWritingModule && !viewerMode && !isReadOnly;
  const canLocate = canEdit && isCommandsToolbarModuleKey(moduleKey);

  return { canEdit, canLocate };
}
