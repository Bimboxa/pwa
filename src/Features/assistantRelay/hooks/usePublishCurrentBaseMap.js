import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setAssistantRelayPublishStatus,
  setAssistantRelaySnapshot,
} from "../assistantRelaySlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";

import useAssistantRelayConfig from "./useAssistantRelayConfig";
import publishBaseMapSnapshotService from "../services/publishBaseMapSnapshotService";
import { describeRelayError } from "../services/assistantRelayClient";

export default function usePublishCurrentBaseMap() {
  const dispatch = useDispatch();
  const config = useAssistantRelayConfig();

  const mainBaseMap = useMainBaseMap();
  const templates = useAnnotationTemplates();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const publishStatus = useSelector((s) => s.assistantRelay.publishStatus);

  const publish = useCallback(async () => {
    if (!mainBaseMap?.id) return null;
    dispatch(
      setAssistantRelayPublishStatus({ status: "publishing", message: null })
    );
    try {
      const snapshot = await publishBaseMapSnapshotService({
        baseMap: mainBaseMap,
        projectId,
        scopeId,
        listingId,
        templates,
        config,
      });
      dispatch(setAssistantRelaySnapshot(snapshot));
      dispatch(
        setAssistantRelayPublishStatus({
          status: "success",
          message: `Fond publié (${snapshot?.image?.width}×${snapshot?.image?.height}).`,
        })
      );
      return snapshot;
    } catch (e) {
      console.log("[assistantRelay] publish failed", e);
      dispatch(
        setAssistantRelayPublishStatus({
          status: "error",
          message: e?.code ? describeRelayError(e) : e?.message,
        })
      );
      return null;
    }
  }, [mainBaseMap, projectId, scopeId, listingId, templates, config, dispatch]);

  return { publish, publishStatus, mainBaseMap };
}
