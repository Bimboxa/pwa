import { useDispatch } from "react-redux";

import restorePovViewService from "../services/restorePovViewService";

// Restores the whole saved view of a POV: displayed 2D/3D editor, frame
// aspect ratio + legend, template visibility, baseMaps + active versions,
// and camera (deferred, see restorePovViewService).
//
// `animate`: fly the camera from the displayed view to the saved one.
export default function useRestorePov() {
  const dispatch = useDispatch();

  return async function restorePov(pov, { animate = false } = {}) {
    await restorePovViewService({ pov, dispatch, animate });
  };
}
