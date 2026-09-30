import { useSyncExternalStore } from "react";

import {
  getScene3dHeightMapStatus,
  subscribeScene3dHeightMapStatus,
} from "../services/scene3dHeightMapStore";

// Live status of the scan height maps (see scene3dHeightMapStore):
// null | {status: "LOADING", done, total} | {status: "READY"} |
// {status: "MISSING"} | {status: "ERROR", error}.
export default function useScene3dHeightMapStatus() {
  return useSyncExternalStore(
    subscribeScene3dHeightMapStatus,
    getScene3dHeightMapStatus
  );
}
