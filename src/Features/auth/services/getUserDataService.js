import getTokenFromLocalStorage from "./getTokenFromLocalStorage";
import getUserProfileFromLocalStorage from "./getUserProfileFromLocalStorage";
import resolveQueryString from "Features/appConfig/utils/resolveQueryString";

export async function getUserDataService({ serviceUrl, queryParams }) {
  // data

  const _userProfile = getUserProfileFromLocalStorage();
  const _token = getTokenFromLocalStorage();

  // fallback

  const trigram = _userProfile?.trigram;
  const token = _token;

  if (!trigram || !token) throw new Error("Both id and apiToken are required");

  // main
  const queryString = resolveQueryString(queryParams, { token, trigram });
  const url = `${serviceUrl}${queryString}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Network response was not ok");

  return await response.json();
}
