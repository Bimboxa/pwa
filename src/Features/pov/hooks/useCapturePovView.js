import { useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import captureMapAsPng from "Features/mapEditor/utils/captureMapAsPng";
import snapshotThreedCanvasForCapture from "Features/threedEditor/utils/snapshotThreedCanvasForCapture";
import resizeImageToLowResolution from "Features/images/utils/resizeImageToLowResolution";
import snapshotPovViewService from "../services/snapshotPovViewService";

const MAX_IMAGE_SIZE = 200 * 1024; // thumbnail budget (POV list + Krto export)

// Captures the currently displayed framed view: stores the <=200KB thumbnail
// in db.files (fresh fileName each time so usePovImageUrl refreshes) and
// snapshots the view metadata. Shared by useCreatePov and useUpdatePovView.
export default function useCapturePovView() {
  const viewerMode = useSelector((s) => s.pov.viewerMode);
  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const panelOpen = useSelector((s) =>
    Boolean(s.rightPanel.selectedMenuItemKey)
  );
  const panelWidth = useSelector((s) => s.rightPanel.width);
  const rightInset = panelOpen ? panelWidth : 0;

  return async function capturePovView() {
    const isThreed = viewerMode === "THREED";
    const hostKey = isThreed ? "THREED" : "MAP";

    // thumbnail capture (low pixelRatio: it gets resized to <= 200 KB)
    const blob = await captureMapAsPng({
      viewerKey: hostKey,
      target: "blob",
      aspectRatio,
      pixelRatio: 1,
      rightInset,
      prepareHost: isThreed ? snapshotThreedCanvasForCapture : undefined,
    });
    if (!blob) {
      console.warn("[useCapturePovView] capture failed");
      return null;
    }

    const fileName = `pov_${nanoid()}.png`;
    const file = new File([blob], fileName, { type: "image/png" });
    const lowResFile =
      (await resizeImageToLowResolution(file, MAX_IMAGE_SIZE)) ?? file;

    await db.files.put({
      fileName,
      srcFileName: fileName,
      fileMime: "image/png",
      fileType: "IMAGE",
      fileArrayBuffer: await lowResFile.arrayBuffer(),
      projectId,
    });

    const metadata = await snapshotPovViewService({ rightInset });

    return { image: { fileName }, ...metadata };
  };
}
