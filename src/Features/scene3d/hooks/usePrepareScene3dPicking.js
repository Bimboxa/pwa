import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import { prepareScene3dPicking } from "../services/intersectScene3d";
import useScene3dPickingStatus from "./useScene3dPickingStatus";

const READY_MESSAGE = "Scène 3D prête : les points se posent sur le scan.";
const ERROR_MESSAGE = "La scène 3D n'a pas pu être préparée pour le dessin.";

// Drawing on the scan base maps needs their picking data
// (scene3dPickStore), built on demand. While a 3D drawing tool is active,
// start building it for the scans of the scene right away — not on the
// first pointer move — and tell the user when it is ready (points cannot
// land on a scan before that; the live progress is shown by
// SectionScene3dPickingStatus).
export default function usePrepareScene3dPicking(active) {
  const dispatch = useDispatch();

  // data — bumped each time the base map groups / annotation objects are
  // (re)loaded: a scan base map shown or switched to its mesh display while
  // the tool is armed is prepared too.

  const annotationsLoadTick = useSelector(
    (s) => s.threedEditor.annotationsLoadTick
  );
  const baseMapsLoadTick = useSelector((s) => s.threedEditor.baseMapsLoadTick);
  const status = useScene3dPickingStatus()?.status ?? null;

  useEffect(() => {
    if (!active) return;
    prepareScene3dPicking(getActiveThreedEditor());
  }, [active, annotationsLoadTick, baseMapsLoadTick]);

  // End of the preparation → toast (only on the LOADING → … transition).
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
