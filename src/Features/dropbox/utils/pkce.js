export async function generatePKCE() {
  const array = new Uint32Array(56 / 2);
  crypto.getRandomValues(array);
  const codeVerifier = Array.from(array, (dec) =>
    ("0" + dec.toString(16)).slice(-2)
  ).join("");

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const base64Digest = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return {codeVerifier, codeChallenge: base64Digest};
}
