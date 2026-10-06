import { useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";

import db from "App/db/db";

import isolateSegmentService from "../services/isolateSegmentService";
import {
  ISOLATE_SEGMENT_DONE_MESSAGE,
  ISOLATE_SEGMENT_READ_ONLY_MESSAGE,
  getIsolateSegmentRefusedMessage,
} from "../utils/isolateSegmentMessages";
import selectIsolatedAnnotation from "../utils/selectIsolatedAnnotation";

// « Isoler un segment » (2D, ISOLATE_SEGMENT drawing mode): InteractionLayer
// hands over the clicked `data-part-id` segment — the annotation id and the
// index of the renderer's segment list, which is the index of the segment's
// START point in the RESOLVED points (orphan refs dropped, arc halves at
// their own start). The start point id is read on the resolved annotation,
// never on the raw row. `annotations`: the resolved list of MainMapEditorV3.
export default function useHandleIsolateSegment({ annotations, baseMap }) {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();
  const { isReadOnly: isReadOnlyScope } = useReadOnlyScope();
  const { canEditAnnotation } = useAnnotationPermissions({ annotations });

  // state

  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  const baseMapRef = useRef(baseMap);
  baseMapRef.current = baseMap;
  const busyRef = useRef(false);

  // helpers

  const toast = (message, isError = true) =>
    dispatch(setToaster({ message, isError }));

  // handlers

  return async function handleIsolateSegment(annotationId, segmentIndex) {
    if (busyRef.current) return;
    const resolved = annotationsRef.current?.find((a) => a.id === annotationId);
    const segmentStartPointId = resolved?.points?.[segmentIndex]?.id;
    if (!segmentStartPointId) {
      toast("Segment introuvable");
      return;
    }
    if (isReadOnlyScope) {
      toast(ISOLATE_SEGMENT_READ_ONLY_MESSAGE);
      return;
    }
    if (!canEditAnnotation(annotationId)) return; // self-toasting

    busyRef.current = true;
    try {
      const annotation = await db.annotations.get(annotationId);
      const result = await isolateSegmentService({
        annotation,
        segmentStartPointId,
        projectId,
        imageSize: baseMapRef.current?.getImageSize?.(),
        meterByPx: baseMapRef.current?.meterByPx,
        createAnnotationFn: createAnnotation,
        updateAnnotationFn: updateAnnotation,
      });
      if (result.status !== "done") {
        toast(getIsolateSegmentRefusedMessage(result.reason));
        return;
      }
      selectIsolatedAnnotation(dispatch, {
        id: result.isolatedId,
        type: annotation.type,
        listingId: annotation.listingId,
        annotationTemplateId: annotation.annotationTemplateId,
      });
      toast(ISOLATE_SEGMENT_DONE_MESSAGE, false);
    } finally {
      busyRef.current = false;
    }
  };
}
