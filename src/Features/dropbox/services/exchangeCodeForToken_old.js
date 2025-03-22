export default async function exchangeCodeForToken(code) {
  const codeVerifier = sessionStorage.getItem("dropbox_pkce_verifier");
  const client_id = import.meta.env.VITE_DROPBOX_CLIENT_ID;
  const redirect_uri = import.meta.env.VITE_DROPBOX_REDIRECT_URI;

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id,
      code_verifier: codeVerifier,
      redirect_uri,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || "Failed to get access token");
  }

  return data.access_token;
}
