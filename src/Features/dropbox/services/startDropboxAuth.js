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

  let popup = null;
  if (withPopup) {
    popup = window.open(authUrl, "_blank", "width=600,height=600");
  } else {
    window.location.href = authUrl;
  }

  return new Promise((resolve) => {
    const listener = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.type === "DROPBOX_AUTH" && event.data.code) {
        window.removeEventListener("message", listener);
        if (popup) popup.close();
        resolve(event.data.code);
      }
    };
    window.addEventListener("message", listener);
  });
}
