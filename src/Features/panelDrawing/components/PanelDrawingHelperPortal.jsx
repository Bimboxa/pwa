import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSelector } from "react-redux";

import SectionDrawingHelperContent from "Features/mapEditor/components/SectionDrawingHelperContent";
import { PANEL_DRAWING_HELPER_HOST_ID } from "./SectionPanelDrawingHelper";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

// ---------------------------------------------------------------------------
// PanelDrawingHelperPortal — mounted INSIDE MainMapEditorV3 (within its
// SmartZoomProvider / DrawingMetricsProvider) and portaled into the docked
// Dessin panel's helper host div. Context flows through the React tree, not
// the DOM, so the loupe (SmartDetectContainer / InteractionLayer portal)
// keeps working while the helper displays in the left panel.
// ---------------------------------------------------------------------------

export default function PanelDrawingHelperPortal() {
  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  // 3D-toggled editor: the panel renders the helper content directly (no
  // SmartZoom dependency there) — no host to portal into.
  const isThreedEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );

  // state

  const [host, setHost] = useState(null);

  // effect - the panel renders the host div in the same commit as the drawing
  // mode swap; effects run after the full commit, so the node exists here.

  useEffect(() => {
    if (!enabledDrawingMode || isThreedEditor) {
      setHost(null);
      return;
    }
    setHost(document.getElementById(PANEL_DRAWING_HELPER_HOST_ID));
  }, [enabledDrawingMode, isThreedEditor]);

  // render

  if (!host) return null;

  return createPortal(<SectionDrawingHelperContent />, host);
}
