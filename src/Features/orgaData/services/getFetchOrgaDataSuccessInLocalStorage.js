export default function getFetchOrgaDataSuccessInLocalStorage() {
  const string = localStorage.getItem("fetchOrgaDataSuccess");
  return string === "success";
}
