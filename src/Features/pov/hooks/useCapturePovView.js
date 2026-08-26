import { useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import captureMapAsPng from "Features/mapEditor/utils/captureMapAsPng";
import snapshotThreedCanvasForCapture from "Features/threedEditor/utils/snapshotThreedCanvasForCapture";
import resizeImageToLowResolution from "Features/images/utils/resizeImageToLowResolution";
import snapshotPovViewService from "../services/snapshotPovViewService";
import useCaptureAspectRatio from "Features/mapEditor/hooks/useCaptureAspectRatio";

const MAX_IMAGE_SIZE = 200 * 1024; // thumbnail budget (POV list + Krto export)

// Captures the currently displayed framed view: stores the <=200KB thumbnail
// in db.files (fresh fileName each time so usePovImageUrl refreshes) and
// snapshots the view metadata. Shared by useCreatePov and useUpdatePovView.
//
// Options:
// - viewerMode: overrides s.pov.viewerMode. The capture tool runs outside the
//   POV module, so it must target its own host (selectCaptureHostViewerKey)
//   rather than the POV module's last mode — for the capture AND for the
//   metadata (pov.viewerMode drives the restore).
// - withRawImage: also stores the full-resolution capture as `rawImage`. That
//   file row carries no listingId, which is what keeps it out of the Krto zip
//   (see createKrtoZip): it is regenerable from the POV module.
export default function useCapturePovView() {
  const povViewerMode = useSelector((s) => s.pov.viewerMode);
  // Resolved value (preset key or numeric base map ratio): also what gets
  // persisted on the pov record, so the restore does not depend on whichever
  // base map is active later.
  const aspectRatio = useCaptureAspectRatio();
  const whiteBackground = useSelector(
    (s) => s.mapEditor.imageModeWhiteBackground
  );
  const roundedBorderMask = useSelector((s) => s.mapEditor.imageModeBorder);
  const highRes = useSelector((s) => s.mapEditor.imageModeHighRes);
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async function capturePovView({
    viewerMode,
    withRawImage = false,
  } = {}) {
    const mode = viewerMode ?? povViewerMode;
    const isThreed = mode === "THREED";
    const hostKey = isThreed ? "THREED" : "MAP";

    const captureOptions = {
      viewerKey: hostKey,
      target: "blob",
      aspectRatio,
      whiteBackground,
      roundedBorderMask,
      prepareHost: isThreed ? snapshotThreedCanvasForCapture : undefined,
    };

    // thumbnail capture (low pixelRatio: it gets resized to <= 200 KB)
    const blob = await captureMapAsPng({ ...captureOptions, pixelRatio: 1 });
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

    // full-resolution capture, stored unresized. A failure here must not
    // block the POV: the thumbnail is already written.
    let rawImage = null;
    if (withRawImage) {
      const rawBlob = await captureMapAsPng({
        ...captureOptions,
        pixelRatio: highRes ? 4 : 2,
      });
      if (rawBlob) {
        const rawFileName = `pov_raw_${nanoid()}.png`;
        await db.files.put({
          fileName: rawFileName,
          srcFileName: rawFileName,
          fileMime: "image/png",
          fileType: "IMAGE",
          fileArrayBuffer: await rawBlob.arrayBuffer(),
          projectId,
        });
        rawImage = { fileName: rawFileName };
      } else {
        console.warn("[useCapturePovView] raw image capture failed");
      }
    }

    const metadata = await snapshotPovViewService({ viewerMode, aspectRatio });

    return { image: { fileName }, rawImage, ...metadata };
  };
}
