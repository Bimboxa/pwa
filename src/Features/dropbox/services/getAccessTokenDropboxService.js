export default async function getAccessTokenDropboxService({token, clientId}) {
  const url = "https://services-tokens.bimboxa.com/accessToken";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
    }),
  });
  const {accessToken, expiresIn} = await res.json();

  return {accessToken, expiresIn};
}
