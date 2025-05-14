export default function setFetchOrgaDataSuccessInLocalStorage(boolean) {
  localStorage.setItem("fetchOrgaDataSuccess", boolean ? "true" : "false");
}
