export default async function exchangeCodeForToken({code, token, clientId}) {
  const codeVerifier = sessionStorage.getItem("dropbox_pkce_verifier");

  const redirect_uri = import.meta.env.VITE_DROPBOX_REDIRECT_URI;

  const response = await fetch(
    "https://services-tokens.bimboxa.com/exchangeToken",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        code,
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri,
        code_verifier: codeVerifier,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || "Failed to get access token");
  }

  return data;
}
