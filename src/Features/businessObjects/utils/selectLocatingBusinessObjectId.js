import { LOCATE_BUSINESS_OBJECT_INTERCEPTOR_KEY } from "../constants/locateBusinessObjectInterceptor";

// Business object currently being located (a draw armed by "Localiser"), read
// from the transport-only commitInterceptor carried by the drawing draft. Any
// re-arm / Escape replaces the draft, so no dedicated redux flag is needed.
export default function selectLocatingBusinessObjectId(state) {
  const interceptor = state.annotations?.newAnnotation?.commitInterceptor;
  if (interceptor?.key !== LOCATE_BUSINESS_OBJECT_INTERCEPTOR_KEY) return null;
  return interceptor.context?.businessObjectId ?? null;
}
