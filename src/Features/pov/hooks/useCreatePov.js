import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { setPovDraftDescription, setPovViewFreeze } from "../povSlice";

import db from "App/db/db";

import useCapturePovView from "./useCapturePovView";
import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";

// "Enregistrer la vue": captures the framed view (thumbnail + metadata) and
// creates the POV record (appended at the end of the list).
export default function useCreatePov() {
  const dispatch = useDispatch();

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const userProfile = useSelector((s) => s.auth.userProfile);
  const draftDescription = useSelector((s) => s.pov.draftDescription);
  const rightPanelIsOpen = useSelector((s) =>
    Boolean(s.rightPanel.selectedMenuItemKey)
  );

  const capturePovView = useCapturePovView();

  return async function createPov({ lastSortIndex = null } = {}) {
    if (!projectId || !scopeId) return null;

    const view = await capturePovView();
    if (!view) return null;

    // createdBy trigram follows the scopeConfiguration pattern
    const debugAuth = getDebugAuthFromLocalStorage();
    const createdBy = {
      idMaster: userProfile?.idMaster ?? debugAuth?.userIdMaster ?? null,
      trigram: userProfile?.trigram ?? debugAuth?.trigram ?? null,
    };

    const record = {
      id: nanoid(),
      projectId,
      scopeId,
      sortIndex: generateKeyBetween(lastSortIndex, null),
      description: draftDescription ?? "",
      createdBy,
      ...view,
    };

    await db.povs.add(record);
    dispatch(setPovDraftDescription(""));
    // The view was just captured on the live content: no freeze to inherit
    // (its own viewCreatedAt is now, it would filter nothing anyway).
    dispatch(setPovViewFreeze(null));

    // Select the new POV. The right panel is only switched to its properties
    // when it is ALREADY open: opening it would shift the capture frame
    // (rightInset) right after the view was snapshotted with the frame it had.
    dispatch(setSelectedItem({ id: record.id, type: "POV" }));
    if (rightPanelIsOpen)
      dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));

    return record;
  };
}
