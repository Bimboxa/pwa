import { LOCATE_BUSINESS_OBJECT_INTERCEPTOR_KEY } from "../constants/locateBusinessObjectInterceptor";

// Transport-only draft props that turn a draw into a "Localiser": the
// LOCATE_BUSINESS_OBJECT commit interceptor links the created annotation as
// the object's main annotation on its base map (drawingCommitInterceptors).
export default function getLocateBusinessObjectDraftProps(businessObjectId) {
  if (!businessObjectId) return {};
  return {
    commitInterceptor: {
      key: LOCATE_BUSINESS_OBJECT_INTERCEPTOR_KEY,
      context: { businessObjectId },
    },
  };
}
