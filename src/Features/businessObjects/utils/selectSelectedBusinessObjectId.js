// Business object SELECTED in the drawer tree — it lives in the selection
// slice ({type: "BUSINESS_OBJECT"}), so the right panel routes on the
// selection alone and a map selection replaces it like any other item. The
// PERSISTENT counterpart (popper "Localisation" mode, locate interceptor) is
// businessObjects.activeBusinessObjectId.
//
// Pure selector (no hooks): usable from components and from other selectors.
export default function selectSelectedBusinessObjectId(s) {
  const item = s.selection?.selectedItems?.[0];
  return item?.type === "BUSINESS_OBJECT" ? item.id : null;
}
