import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import db from "App/db/db";

import captureMapAsPng from "Features/mapEditor/utils/captureMapAsPng";
import snapshotThreedCanvasForCapture from "Features/threedEditor/utils/snapshotThreedCanvasForCapture";
import resizeImageToLowResolution from "Features/images/utils/resizeImageToLowResolution";
import snapshotPovViewService from "../services/snapshotPovViewService";
import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";

const MAX_IMAGE_SIZE = 200 * 1024; // thumbnail budget (POV list + Krto export)

// "Enregistrer la vue": captures the framed view, stores the thumbnail in
// db.files and creates the POV record (appended at the end of the list).
export default function useCreatePov() {
  const dispatch = useDispatch();

  const viewerMode = useSelector((s) => s.pov.viewerMode);
  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const userProfile = useSelector((s) => s.auth.userProfile);
  const panelOpen = useSelector((s) =>
    Boolean(s.rightPanel.selectedMenuItemKey)
  );
  const panelWidth = useSelector((s) => s.rightPanel.width);
  const rightInset = panelOpen ? panelWidth : 0;

  return async function createPov({ lastSortIndex = null } = {}) {
    if (!projectId || !scopeId) return null;

    const id = nanoid();
    const isThreed = viewerMode === "THREED";
    const hostKey = isThreed ? "THREED" : "MAP";

    // 1. thumbnail capture (low pixelRatio: it gets resized to <= 200 KB)
    const blob = await captureMapAsPng({
      viewerKey: hostKey,
      target: "blob",
      aspectRatio,
      pixelRatio: 1,
      rightInset,
      prepareHost: isThreed ? snapshotThreedCanvasForCapture : undefined,
    });
    if (!blob) {
      console.warn("[useCreatePov] capture failed");
      return null;
    }

    const fileName = `pov_${id}.png`;
    const file = new File([blob], fileName, { type: "image/png" });
    const lowResFile = (await resizeImageToLowResolution(file, MAX_IMAGE_SIZE))
      ?? file;

    await db.files.put({
      fileName,
      srcFileName: fileName,
      fileMime: "image/png",
      fileType: "IMAGE",
      fileArrayBuffer: await lowResFile.arrayBuffer(),
      projectId,
    });

    // 2. view metadata
    const metadata = await snapshotPovViewService({ rightInset });

    // 3. record — createdBy trigram follows the scopeConfiguration pattern
    const debugAuth = getDebugAuthFromLocalStorage();
    const createdBy = {
      idMaster: userProfile?.idMaster ?? debugAuth?.userIdMaster ?? null,
      trigram: userProfile?.trigram ?? debugAuth?.trigram ?? null,
    };

    const record = {
      id,
      projectId,
      scopeId,
      sortIndex: generateKeyBetween(lastSortIndex, null),
      description: "",
      createdBy,
      image: { fileName },
      ...metadata,
    };

    await db.povs.add(record);

    // select the new POV and open its properties panel
    dispatch(setSelectedItem({ id, type: "POV" }));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));

    return record;
  };
}
