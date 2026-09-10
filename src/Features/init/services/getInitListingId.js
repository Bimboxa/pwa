export default function getInitListingId() {
  const initListingId = localStorage.getItem("initListingId");
  // Defensive: earlier versions stored the stringified null / undefined.
  if (
    !initListingId ||
    initListingId === "null" ||
    initListingId === "undefined"
  )
    return null;
  return initListingId;
}
