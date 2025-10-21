export default async function uploadMediaServiceV2({
  id,
  file,
  orgaCode,
  typeCode,
  projectId,
  metadata,
}) {
  const API = "https://public.media.bimboxa.com";

  // session

  await fetch(`${API}/session`, {
    method: "GET",
    credentials: "include", // REQUIRED to accept Set-Cookie cross-site
    headers: { Accept: "text/plain" },
  });

  // get upload token

  const res2 = await fetch(`${API}/get-upload-token`, {
    method: "GET",
    credentials: "include", // <- sends the "sid" cookie
    headers: { Accept: "application/json" }, // your route returns JSON
  });

  if (!res2.ok) return;

  const { token } = await res2.json();

  // upload

  const form = new FormData();
  form.append("blob", file);
  form.append("orgaCode", orgaCode);
  form.append("typeCode", typeCode);
  form.append("projectId", projectId);
  if (metadata) form.append("mediaMetadata", JSON.stringify(metadata));
  //form.append("mediaMetadata", metadata);

  const res = await fetch(`${API}/media/${id}`, {
    method: "PUT",
    credentials: "include",
    body: form,
    headers: { "X-Upload-Token": token },
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`/upload failed: ${res.status} ${msg}`);
  }
  return res.json(); // { ok, key, size, mime }
}
