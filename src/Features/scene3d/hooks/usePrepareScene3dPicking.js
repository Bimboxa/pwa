import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import { prepareScene3dPicking } from "../services/intersectScene3d";

const PREPARING_MESSAGE = "Préparation de la scène 3D pour le dessin…";

// Drawing on the SCENE_3D scans needs their picking data (scene3dPickStore),
// built on demand. While a 3D drawing tool is active, start building it for
// the scans of the scene right away — not on the first pointer move — and
// tell the user when that takes a moment (points cannot land on a scan
// before it is ready).
export default function usePrepareScene3dPicking(active) {
  const dispatch = useDispatch();

  // data — bumped each time the 3D annotation objects are (re)loaded: a scan
  // added or switched to its mesh display while the tool is armed is
  // prepared too.

  const annotationsLoadTick = useSelector(
    (s) => s.threedEditor.annotationsLoadTick
  );

  useEffect(() => {
    if (!active) return;
    const loading = prepareScene3dPicking(getActiveThreedEditor());
    if (loading) dispatch(setToaster({ message: PREPARING_MESSAGE }));
  }, [active, annotationsLoadTick, dispatch]);
}
