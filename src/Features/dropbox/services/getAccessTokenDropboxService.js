export default async function getAccessTokenDropboxService({token}) {
  const url = "https://services-tokens.bimboxa.com/accessToken";
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const {accessToken, expireIn} = await res.json();

  return {accessToken, expireIn};
}
