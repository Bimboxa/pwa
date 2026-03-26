import { nanoid } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";

import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import splitPolylineAtSegment from "Features/mapEditor/utils/splitPolylineAtSegment";
import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

export default function useHandleCutSegment({ newEntity } = {}) {
  const dispatch = useDispatch();
  const createEntity = useCreateEntity();
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();

  /**
   * Cut a polyline/strip annotation by removing the segment at segmentIndex.
   *
   * @param {string} annotationId - The annotation to cut
   * @param {number} segmentIndex - Index of the segment to remove
   */
  const handleCutSegment = async (annotationId, segmentIndex) => {
    const annotation = await db.annotations.get(annotationId);
    if (!annotation) {
      dispatch(setToaster({ message: "Annotation not found", isError: true }));
      return;
    }

    if (!["POLYLINE", "STRIP"].includes(annotation.type)) {
      dispatch(
        setToaster({
          message: "Cut segment only works on polylines and strips",
          isError: true,
        })
      );
      return;
    }

    const result = splitPolylineAtSegment(
      annotation.points,
      segmentIndex,
      annotation.closeLine
    );

    if (!result) {
      dispatch(
        setToaster({ message: "Cannot cut at this segment", isError: true })
      );
      return;
    }

    if (result.piece2) {
      // Open polyline split into two pieces
      await updateAnnotation({
        ...annotation,
        points: result.piece1,
        closeLine: false,
      });

      // Create a new entity + annotation for the second piece
      const entity = await createEntity(newEntity);
      const {
        id: _id,
        entityId: _eid,
        cuts: _cuts,
        ...hostProps
      } = annotation;
      await createAnnotation({
        ...hostProps,
        id: nanoid(),
        entityId: entity.id,
        points: result.piece2,
        closeLine: false,
      });
    } else {
      // Closed polyline → open (single reordered piece)
      await updateAnnotation({
        ...annotation,
        points: result.piece1,
        closeLine: false,
      });
    }

    dispatch(
      setToaster({ message: "Segment cut successfully", isError: false })
    );
  };

  return handleCutSegment;
}
