export default function setInitScopeOpeningSource(openingSource) {
  if (!openingSource) {
    localStorage.removeItem("initScopeOpeningSource");
    return;
  }
  localStorage.setItem("initScopeOpeningSource", JSON.stringify(openingSource));
}
