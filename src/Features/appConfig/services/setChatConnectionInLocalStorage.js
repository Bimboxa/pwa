// Only { mode, baseUrl } is stored — never the PWA key or the JWT.
export default function setChatConnectionInLocalStorage(connection) {
  if (!connection) {
    localStorage.removeItem("chatConnection");
    return;
  }
  localStorage.setItem(
    "chatConnection",
    JSON.stringify({ mode: connection.mode, baseUrl: connection.baseUrl })
  );
}
