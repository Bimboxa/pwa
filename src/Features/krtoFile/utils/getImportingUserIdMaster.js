import store from "App/store";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";

// Importing user's master id, normalized to a string like the ownership layer
// expects (App/db/ownership.normalizeOwnerId). Shared by the zip loaders
// (loadKrtoZip, loadProjectExportZip) so re-owned rows agree on the owner id.
export default function getImportingUserIdMaster() {
  const raw = getUserIdMaster(store.getState()?.auth?.userProfile);
  return raw != null ? String(raw) : "anonymous";
}
