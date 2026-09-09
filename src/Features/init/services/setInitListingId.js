// Clearing the selection must REMOVE the key: localStorage stringifies, so
// setItem(null) stores the string "null", which comes back as a truthy id and
// re-selects a listing that does not exist.
export default function setInitListingId(initListingId) {
  if (!initListingId) {
    localStorage.removeItem("initListingId");
    return;
  }
  localStorage.setItem("initListingId", initListingId);
}
