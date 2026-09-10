import { LINK_BUSINESS_OBJECT_INTERCEPTOR_KEY } from "../constants/linkBusinessObjectInterceptor";

// Business object the current drawing draft links to (a draw armed while an
// object is ACTIVE in a business-objects module), read from the transport-only
// commitInterceptor carried by the draft.
export default function selectLinkBusinessObjectDraftId(state) {
  const interceptor = state.annotations?.newAnnotation?.commitInterceptor;
  if (interceptor?.key !== LINK_BUSINESS_OBJECT_INTERCEPTOR_KEY) return null;
  return interceptor.context?.businessObjectId ?? null;
}
