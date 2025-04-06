import {generatePKCE} from "../utils/pkce";

export default async function openDropboxAuthPopup(clientId) {
  const CLIENT_ID = clientId;
  const REDIRECT_URI = import.meta.env.VITE_DROPBOX_REDIRECT_URI;

  const {codeVerifier, codeChallenge} = await generatePKCE();

  sessionStorage.setItem("dropbox_pkce_verifier", codeVerifier);

  const authUrl = `https://www.dropbox.com/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&code_challenge_method=S256&code_challenge=${codeChallenge}&token_access_type=offline`;

  const popup = window.open(authUrl, "_blank", "width=600,height=600");

  return new Promise((resolve) => {
    const listener = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.type === "DROPBOX_AUTH" && event.data.code) {
        window.removeEventListener("message", listener);
        popup.close();
        resolve(event.data.code);
      }
    };
    window.addEventListener("message", listener);
  });
}
