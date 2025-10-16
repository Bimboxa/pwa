export async function uploadMediaService({ file, path, token }) {
  const API = "https://public.media.bimboxa.com";

  const form = new FormData();
  form.append("file", file);
  form.append("path", path); // e.g. "/images/client123/project456/"

  const res = await fetch(`${API}/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
    headers: { "X-Upload-Token": token },
    // If your token is bound to sid and you enforce it at /upload, you can also add:
    // credentials: 'include'
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`/upload failed: ${res.status} ${msg}`);
  }
  return res.json(); // { ok, key, size, mime }
}
