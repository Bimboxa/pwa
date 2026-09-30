import { useSyncExternalStore } from "react";

import {
  getScene3dPickStatus,
  subscribeScene3dPickStatus,
} from "../services/scene3dPickStore";

// Live status of the scan picking data (see scene3dPickStore):
// null | {status: "LOADING", done, total} | {status: "READY"} |
// {status: "MISSING"} | {status: "ERROR", error}.
export default function useScene3dPickingStatus() {
  return useSyncExternalStore(subscribeScene3dPickStatus, getScene3dPickStatus);
}
