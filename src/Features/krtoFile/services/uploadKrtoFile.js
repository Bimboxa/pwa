import createKrtoFile from "./createKrtoFile";
import { uploadMediaService } from "Features/sync/services/uploadMediaService";

export default async function uploadKrtoFile({ orgaCode, projectId }) {
  const API = "https://public.media.bimboxa.com";

  const file = await createKrtoFile(projectId, {
    zip: true,
    nameFileWithTimestamp: false,
  });

  await fetch(`${API}/session`, {
    method: "GET",
    credentials: "include", // REQUIRED to accept Set-Cookie cross-site
    headers: { Accept: "text/plain" },
  });

  const res2 = await fetch(`${API}/get-upload-token`, {
    method: "GET",
    credentials: "include", // <- sends the "sid" cookie
    headers: { Accept: "application/json" }, // your route returns JSON
  });

  if (!res2.ok) return;

  const { token } = await res2.json();

  const path = `krtos/${orgaCode}/${projectId}/`;

  const response = await uploadMediaService({ file, path, token });

  console.log("uploadKrtoFile", response);
}
