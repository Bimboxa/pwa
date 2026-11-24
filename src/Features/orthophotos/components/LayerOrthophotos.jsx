import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedOrthophotoId } from "../orthophotosSlice";

import LayerOrthophotoStations from "./LayerOrthophotoStations";
import PopperOrthophoto from "./PopperOrthophoto";
import PortalEditorFloatingPanels from "Features/layout/components/PortalEditorFloatingPanels";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useOrthophotos from "../hooks/useOrthophotos";
import useIsMainBaseMapOrthophoto from "../hooks/useIsMainBaseMapOrthophoto";
import {
  selectCaptureFramingActive,
  selectEffectiveViewerKey,
} from "Features/viewers/utils/effectiveViewerKey";
import { ORTHOPHOTOS_TOOL_KEY } from "../constants/orthophotosTool";

function LayerOrthophotosContent({ editable }) {
  // data

  const mainBaseMap = useMainBaseMap();
  const orthophotos = useOrthophotos({ baseMapId: mainBaseMap?.id });

  // render

  if (!mainBaseMap?.isOrthophoto) return null;

  return (
    <>
      <LayerOrthophotoStations
        orthophotos={orthophotos}
        mainBaseMap={mainBaseMap}
        editable={editable}
      />
      {/* Floating panel of the selected orthophoto: rendered in the layout
          host (over the top bar when dragged). */}
      <PortalEditorFloatingPanels>
        <PopperOrthophoto orthophotos={orthophotos} />
      </PortalEditorFloatingPanels>
    </>
  );
}

// Unit orthophotos of the orthomosaic base map displayed by the 2D editor:
// the camera stations (and, from the Orthophotos tool, the handles of the
// orthophoto being adjusted) over the editor, and the floating panel of the
// selected one. Shown while the count chip of the bottom bar is on — only
// then; with the Orthophotos tool of the Fonds de plan module opened, the
// stations can also be dragged. Steps aside while a drawing mode is armed (a
// station must not take a click of the drawing) and under a capture framing.
// Mounted once over the editors area (SectionViewer).
export default function LayerOrthophotos() {
  const dispatch = useDispatch();

  // data

  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const captureFramingActive = useSelector(selectCaptureFramingActive);
  const isDrawing = useSelector((s) => Boolean(s.mapEditor.enabledDrawingMode));
  const showStations = useSelector((s) => s.orthophotos.showStations);
  const hasSelection = useSelector((s) =>
    Boolean(s.orthophotos.selectedOrthophotoId)
  );
  const toolOpened = useSelector(
    (s) =>
      moduleKey === "BASE_MAPS" &&
      s.rightPanel.selectedMenuItemKey === ORTHOPHOTOS_TOOL_KEY
  );
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const isOrthophoto = useIsMainBaseMapOrthophoto();

  // helpers

  const is2dEditor =
    effectiveViewerKey === "MAP" || effectiveViewerKey === "BASE_MAPS";
  // the count chip of the bottom bar rules, even with the tool opened: off,
  // no station, no hover behaviour, no floating panel
  const enabled = is2dEditor && isOrthophoto && showStations;
  const visible = enabled && !isDrawing && !captureFramingActive;

  // effects

  // The selection only lives with the stations of ONE base map — or with
  // the opened tool, whose grid selects a photo to edit it even while the
  // stations are off.
  const keepsSelection = enabled || (toolOpened && isOrthophoto);
  useEffect(() => {
    if (hasSelection && !keepsSelection) {
      dispatch(setSelectedOrthophotoId(null));
    }
  }, [hasSelection, keepsSelection, dispatch]);

  useEffect(() => {
    dispatch(setSelectedOrthophotoId(null));
  }, [mainBaseMapId, dispatch]);

  // render

  if (!visible) return null;
  return <LayerOrthophotosContent editable={toolOpened} />;
}
