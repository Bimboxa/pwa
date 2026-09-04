// Key of the drawing commit interceptor (mapEditor/services/
// drawingCommitInterceptors) armed by the "Localiser" flow: the draft carries
// { key, context: { businessObjectId, businessObjectLabel } } and the created
// annotation becomes the object's main annotation on its base map.
export const LOCATE_BUSINESS_OBJECT_INTERCEPTOR_KEY = "LOCATE_BUSINESS_OBJECT";
