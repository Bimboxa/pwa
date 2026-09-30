import { useEffect, useRef } from "react";

import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import { ensureScene3dHeightMap } from "../services/scene3dHeightMapStore";
import useScene3dHeightMapStatus from "./useScene3dHeightMapStatus";

const READY_MESSAGE =
  "Relief du scan prêt : altitude affichée sous le curseur.";
const ERROR_MESSAGE = "Le relief du scan n'a pas pu être préparé.";

// The cursor altimetry of the 2D editor reads the scan height maps
// (scene3dHeightMapStore). While the mode is on, make the map of the
// displayed scan base map available right away — not on the first pointer
// move — and tell the user when a rebuild (scan imported before the height
// maps existed) is done.
//
// active: the mode is on; scans: the scan base maps (records or BaseMap
// instances carrying `scene3d`) displayed in the editor.
export default function usePrepareScene3dHeightMaps(active, scans) {
  const dispatch = useDispatch();

  // data

  const status = useScene3dHeightMapStatus()?.status ?? null;

  // A new scan (creation, reload, Krto load) is prepared too: key on the
  // scene ids.
  const sceneIdsKey = (scans ?? [])
    .map((b) => b?.scene3d?.sceneId)
    .filter(Boolean)
    .join("|");

  useEffect(() => {
    if (!active || !sceneIdsKey) return;
    (scans ?? []).forEach((baseMap) => {
      const scene3d = baseMap?.scene3d;
      if (!scene3d?.sceneId) return;
      ensureScene3dHeightMap(scene3d.sceneId, {
        bbox: scene3d.bbox,
        projectId: baseMap.projectId,
      });
    });
  }, [active, sceneIdsKey]);

  // End of a rebuild → toast (only on the LOADING → … transition).
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (!active || prev !== "LOADING") return;
    if (status === "READY") {
      dispatch(setToaster({ message: READY_MESSAGE, severity: "success" }));
    } else if (status === "ERROR") {
      dispatch(setToaster({ message: ERROR_MESSAGE, isError: true }));
    }
  }, [status, active, dispatch]);
}
