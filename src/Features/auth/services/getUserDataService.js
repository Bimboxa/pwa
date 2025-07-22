import getTokenFromLocalStorage from "./getTokenFromLocalStorage";
import getUserInfoFromLocalStorage from "./getUserInfoFromLocalStorage";

export async function getUserDataService({ trigram, token }) {
  // data

  const _userInfo = getUserInfoFromLocalStorage();
  const _token = getTokenFromLocalStorage();

  // fallback

  trigram = trigram ?? _userInfo?.trigram;
  token = token ?? _token;

  if (!trigram || !token) throw new Error("Both id and apiToken are required");

  // main
  const url = `https://data.etandex.fr/cold/Staffs/GetFromSIdentifiant?apiToken=${encodeURIComponent(
    token
  )}&id=${encodeURIComponent(trigram)}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Network response was not ok");

  return await response.json();
}
