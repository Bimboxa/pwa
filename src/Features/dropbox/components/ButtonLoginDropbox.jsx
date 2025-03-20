import ButtonBasicMobile from "Features/layout/components/ButtonBasicMobile";

export default function ButtonLoginDropbox() {
  // string

  const loginS = "Se connecter";

  // helpers

  const CLIENT_ID = import.meta.env.VITE_DROPBOX_CLIENT_ID;
  const REDIRECT_URI = import.meta.env.VITE_DROPBOX_REDIRECT_URI;

  // handlers

  function handleClick() {
    const dropboxAuthUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&token_access_type=offline&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}`;

    window.location.href = dropboxAuthUrl;
  }
  return <ButtonBasicMobile label={loginS} onClick={handleClick} />;
}
