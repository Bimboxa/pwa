// Key of the drawing commit interceptor (mapEditor/services/
// drawingCommitInterceptors) armed while an object is ACTIVE in a
// business-objects module and a template of a regular listing is drawn: the
// draft carries { key, context: { businessObjectId } } and the created
// annotation gets a plain link (no isMain) to the object.
export const LINK_BUSINESS_OBJECT_INTERCEPTOR_KEY = "LINK_BUSINESS_OBJECT";
