import { useCallback } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import alignAnnotationsService from "../services/alignAnnotationsService";

// Returns `align(mode, { targets, allAnnotations })`: aligns the resolved
// `targets` (see getAlignTargets) of the main base map on `mode`.
export default function useAlignAnnotations() {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // handlers

  return useCallback(
    async (mode, { targets, allAnnotations }) => {
      try {
        await alignAnnotationsService({
          targets,
          allAnnotations,
          mode,
          imageSize: baseMap?.getImageSize?.(),
          meterByPx: baseMap?.getMeterByPx?.(),
          projectId,
          dispatch,
        });
      } catch (err) {
        console.error("[annotationAlign] align failed", err);
        dispatch(
          setToaster({
            message: "L'alignement n'a pas pu être enregistré",
            severity: "error",
          })
        );
      }
    },
    [baseMap, projectId, dispatch]
  );
}
