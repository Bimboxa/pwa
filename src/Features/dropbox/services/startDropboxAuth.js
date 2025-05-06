import {generatePKCE} from "../utils/pkce";

export default async function startDropboxAuth(clientId, options) {
  const CLIENT_ID = clientId;
  const REDIRECT_URI = import.meta.env.VITE_DROPBOX_REDIRECT_URI;

  // options

  const withPopup = options?.withPopup;

  // main

  const {codeVerifier, codeChallenge} = await generatePKCE();

  sessionStorage.setItem("dropbox_pkce_verifier", codeVerifier);
  sessionStorage.setItem(
    "remote_container",
    JSON.stringify({
      service: "DROPBOX",
      clientId: CLIENT_ID,
    })
  );

  const authUrl = `https://www.dropbox.com/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&code_challenge_method=S256&code_challenge=${codeChallenge}&token_access_type=offline`;

  window.location.href = authUrl;
}
