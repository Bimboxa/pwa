import { useEffect, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

// Subscribe to the cross-tab `selectAnnotationInThreed` event. When it fires
// (each new `triggeredAt`), select the annotation in this (3D) tab — but only
// if it isn't already part of the current annotation selection, so the user's
// existing 3D selection isn't needlessly reset.
//
// The local dispatch is tagged `fromBroadcast` so syncTabsMiddleware does not
// re-broadcast it back across tabs.
export default function useSelectAnnotationOnEvent() {
  const dispatch = useDispatch();
  const store = useStore();
  const request = useSelector((s) => s.threedEditor.selectAnnotationInThreed);
  const lastTriggeredAtRef = useRef(0);

  useEffect(() => {
    if (!request) return;
    const { annotationId, annotationType, listingId, triggeredAt } = request;
    if (!triggeredAt || triggeredAt === lastTriggeredAtRef.current) return;
    lastTriggeredAtRef.current = triggeredAt;
    if (!annotationId) return;

    const selectedItems = store.getState().selection.selectedItems || [];
    const alreadySelected = selectedItems.some(
      (i) =>
        i.type === "NODE" &&
        i.nodeType === "ANNOTATION" &&
        (i.nodeId || i.id) === annotationId
    );
    if (alreadySelected) return;

    dispatch({
      type: "selection/setSelectedItem",
      payload: {
        id: annotationId,
        nodeId: annotationId,
        type: "NODE",
        nodeType: "ANNOTATION",
        annotationType,
        listingId,
      },
      meta: { fromBroadcast: true },
    });
  }, [request, dispatch, store]);
}
