import {useSelector} from "react-redux";
import deleteSyncFiles from "../services/deleteSyncFiles";

export default function useDeleteSyncFiles() {
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  return async () => {
    await deleteSyncFiles(scopeId);
  };
}
