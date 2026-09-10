import { LINK_BUSINESS_OBJECT_INTERCEPTOR_KEY } from "../constants/linkBusinessObjectInterceptor";

// Transport-only draft props that link the drawn annotation to the ACTIVE
// business object: the LINK_BUSINESS_OBJECT commit interceptor writes a plain
// relsBusinessObjectAnnotation row (drawingCommitInterceptors).
export default function getLinkBusinessObjectDraftProps(businessObjectId) {
  if (!businessObjectId) return {};
  return {
    commitInterceptor: {
      key: LINK_BUSINESS_OBJECT_INTERCEPTOR_KEY,
      context: { businessObjectId },
    },
  };
}
