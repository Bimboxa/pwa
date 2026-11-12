import { useSelector } from "react-redux";

import { COMMENTS_MODULE_KEY } from "../constants/commentEntityModel";

import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";

// Comments are written from the Comments module only; everywhere else
// (Viewer module, shared `?mode=viewer` link, read-only scope) they are read.
export default function useCanEditComments() {
  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  const viewerMode = useSelector((s) => s.urlParams.viewerMode);
  const { isReadOnly } = useReadOnlyScope();

  return moduleKey === COMMENTS_MODULE_KEY && !viewerMode && !isReadOnly;
}
