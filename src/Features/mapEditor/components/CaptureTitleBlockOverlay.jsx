import { useDispatch, useSelector } from "react-redux";

import { setImageModeTitleBlock } from "../mapEditorSlice";

import { selectCaptureHostViewerKey } from "Features/viewers/utils/effectiveViewerKey";

import TitleBlockSvg from "Features/titleBlocks/components/TitleBlockSvg";
import DialogEditCaptureTitleBlock from "./DialogEditCaptureTitleBlock";

import useCaptureTitleBlock from "../hooks/useCaptureTitleBlock";
import computeTitleBlockLayout from "Features/titleBlocks/utils/computeTitleBlockLayout";
import { getCartoucheRectBottomRight } from "Features/portfolioEditor/utils/getPageLayout";

// Share of the page inner width taken by the capture cartouche (the carnet
// uses 0.4 on A3+ landscape pages and a full-width TOP_FULL block on A4;
// the capture always sits bottom-right, so A4 pages need a wider block for
// the narrow variant's main column to stay legible). Capped at the A3
// value by getCartoucheRectBottomRight, so A3 landscape == carnet.
const CAPTURE_CARTOUCHE_WIDTH_RATIO = 0.55;

// Cartouche (title block) drawn at the bottom-right of the capture frame,
// laid out in PDF points on the exported page and scaled to the on-screen
// frame (k = frame px / page pt) — the same cartouche size as the Carnet de
// plans page of the same format. Rendered inside ImageModeOverlay's svg as
// a `data-capture-keep data-capture-decor` group: baked into PNG / PDF /
// POV captures like the legend and the logo, excluded from the AI-enhance
// input and composited back over the enhanced image. Double-click opens the
// enlarged edit dialog (values persisted on the scope).
export default function CaptureTitleBlockOverlay({ rect }) {
  const dispatch = useDispatch();

  // data

  const hostViewerKey = useSelector(selectCaptureHostViewerKey);
  const editing = useSelector((s) =>
    Boolean(s.mapEditor.imageModeTitleBlock?.editing)
  );
  const { manifest, values, logoUrl, bindings, pageDims } =
    useCaptureTitleBlock(hostViewerKey);

  // helpers

  const cartouche = getCartoucheRectBottomRight(
    pageDims,
    manifest.height,
    null,
    { widthRatio: CAPTURE_CARTOUCHE_WIDTH_RATIO }
  );
  const k = pageDims.width > 0 ? rect.width / pageDims.width : 0;

  // handlers

  function handleDoubleClick(e) {
    e.stopPropagation();
    e.preventDefault();
    dispatch(setImageModeTitleBlock({ editing: true }));
  }

  function handleCloseDialog() {
    dispatch(setImageModeTitleBlock({ editing: false }));
  }

  // render

  if (!cartouche || !(k > 0)) return null;

  const layoutData = computeTitleBlockLayout(manifest, cartouche, {
    variant: "BOTTOM_RIGHT",
    mode: "CAPTURE",
    values,
    bindings,
  });

  return (
    <g
      data-capture-keep
      data-capture-decor
      transform={`translate(${rect.left}, ${rect.top}) scale(${k})`}
      onDoubleClick={handleDoubleClick}
      style={{ pointerEvents: "auto", cursor: "pointer" }}
    >
      <TitleBlockSvg
        layoutData={layoutData}
        style={manifest.style}
        logoUrl={logoUrl}
      />

      <DialogEditCaptureTitleBlock
        open={editing}
        onClose={handleCloseDialog}
        hostViewerKey={hostViewerKey}
        cartoucheWidth={cartouche.width}
      />
    </g>
  );
}
