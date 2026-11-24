import { useSelector } from "react-redux";

import PopperReconstructionPlayer from "./PopperReconstructionPlayer";
import PortalEditorFloatingPanels from "Features/layout/components/PortalEditorFloatingPanels";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useReconstructionFrames from "../hooks/useReconstructionFrames";
import useIsMainBaseMapReconstruction3d from "../hooks/useIsMainBaseMapReconstruction3d";
import {
  selectCaptureFramingActive,
  selectEffectiveViewerKey,
} from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

function LayerReconstruction3dContent({ is3dEditor }) {
  // data

  const mainBaseMap = useMainBaseMap();
  const frames = useReconstructionFrames({ baseMapId: mainBaseMap?.id });

  // render

  if (!mainBaseMap?.isReconstruction3d || frames.length === 0) return null;

  return (
    /* Floating player: rendered in the layout host (over the top bar when
       dragged). Keyed by the base map: another reconstruction starts over. */
    <PortalEditorFloatingPanels>
      <PopperReconstructionPlayer
        key={mainBaseMap.id}
        baseMap={mainBaseMap}
        frames={frames}
        is3dEditor={is3dEditor}
      />
    </PortalEditorFloatingPanels>
  );
}

// Floating video / photos player of the 3D reconstruction base map displayed
// by the editor, shown while the toggle of the bottom bar is on
// (reconstruction3d.showPlayer). In the 3D editor it drives the camera along
// the path of the reconstruction; in the 2D editors it only plays. Steps
// aside under a capture framing. Mounted once over the editors area
// (SectionViewer).
export default function LayerReconstruction3d() {
  // data

  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const captureFramingActive = useSelector(selectCaptureFramingActive);
  const showPlayer = useSelector((s) => s.reconstruction3d.showPlayer);
  const isReconstruction = useIsMainBaseMapReconstruction3d();

  // helpers

  const is3dEditor = isThreedFamilyViewerKey(effectiveViewerKey);
  const is2dEditor =
    effectiveViewerKey === "MAP" || effectiveViewerKey === "BASE_MAPS";
  const visible =
    showPlayer &&
    isReconstruction &&
    (is2dEditor || is3dEditor) &&
    !captureFramingActive;

  // render

  if (!visible) return null;
  return <LayerReconstruction3dContent is3dEditor={is3dEditor} />;
}
