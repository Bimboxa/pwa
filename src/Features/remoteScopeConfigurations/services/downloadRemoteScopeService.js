import db from "App/db/db";

import resolveUrl from "Features/appConfig/utils/resolveUrl";
import transformObject from "Features/misc/utils/transformObject";
import loadKrtoZip from "Features/krtoFile/services/loadKrtoZip";
import resolveRoute from "../utils/resolveRoute";

/**
 * Installs a remote scope locally WITHOUT opening it: fetches its
 * scopeConfiguration metadata, downloads the zip of the latest version and
 * imports it into the local db. No scope selection, no navigation, no Redux
 * write — the caller decides what to do with the installed scope.
 *
 * `onProgress({ status, progress, fileSize })` — status is one of
 * "fetching_metadata" | "downloading" | "importing", progress in [0..100].
 *
 * `projectId` (optional) forces the local project the scope is installed in;
 * otherwise an existing local project is matched from the metadata.
 *
 * Returns `{ configuration, scope }` (the remote metadata + the local scope
 * row). Throws on any failure.
 */
export default async function downloadRemoteScopeService({
  scopeId,
  appConfig,
  jwt,
  projectId,
  onProgress,
}) {
  const remoteConfig = appConfig?.features?.remoteScopeConfigurations;
  const pullConfig = remoteConfig?.pull;
  const downloadConfig = remoteConfig?.download;
  const mapping = remoteConfig?.mapping;

  let fileSize = null;
  const notify = (status, progress) =>
    onProgress?.({ status, progress, fileSize });

  // 1. metadata

  notify("fetching_metadata", 20);

  if (!pullConfig)
    throw new Error("Configuration de synchronisation manquante");
  const fetchParams = pullConfig.fetchParams;
  if (!fetchParams) throw new Error("fetchParams manquant");

  const resolvedUrl = resolveUrl({
    ...fetchParams.url,
    route: resolveRoute(fetchParams.url.route, { scopeId }),
  });

  const response = await fetch(resolvedUrl, {
    method: fetchParams.method || "GET",
    headers: {
      ...(jwt && { Authorization: `Bearer ${jwt}` }),
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Erreur ${response.status} : scope introuvable`);
  }

  const data = await response.json();
  const configuration = mapping ? transformObject(data, mapping) : data;
  fileSize = configuration.fileSize ?? null;
  notify("fetching_metadata", 30);

  // 2. zip download (streamed, 30% → 80%)

  if (!downloadConfig) {
    throw new Error(
      "Download config manquante (remoteScopeConfigurations.download)"
    );
  }
  const dlFetchParams = downloadConfig.fetchParams;
  const downloadUrl = resolveUrl({
    ...dlFetchParams.url,
    route: resolveRoute(dlFetchParams.url.route, { scopeId }),
  });

  notify("downloading", 30);

  const fileResponse = await fetch(downloadUrl, {
    method: dlFetchParams.method || "GET",
    headers: {
      ...(jwt && { Authorization: `Bearer ${jwt}` }),
    },
  });
  if (!fileResponse.ok) {
    throw new Error(`Erreur ${fileResponse.status} lors du téléchargement`);
  }

  const contentLength = fileResponse.headers.get("content-length");
  const totalBytes = contentLength
    ? parseInt(contentLength, 10)
    : configuration.fileSize;

  let receivedBytes = 0;
  const reader = fileResponse.body.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedBytes += value.length;
    if (totalBytes) {
      notify(
        "downloading",
        Math.min(30 + (receivedBytes / totalBytes) * 50, 80)
      );
    }
  }

  const file = new File([new Blob(chunks)], "remote_scope.zip", {
    type: "application/zip",
  });

  // 3. import

  notify("importing", 85);

  // Attach the import to an existing local project (e.g. created from the
  // dashboard) to avoid a duplicated project: the zip ships the project with
  // its own id, remapped through loadDataToProjectId. Match by
  // projectIdClient (immutable project id) first — the clientRef changes
  // when the project is renumbered — then fall back to the clientRef for
  // projects created locally from the dashboard.
  const existingProject =
    (projectId ? await db.projects.get(projectId) : null) ??
    (configuration.projectIdClient
      ? await db.projects.get(configuration.projectIdClient)
      : null) ??
    (configuration.projectClientRef
      ? await db.projects
          .where("clientRef")
          .equals(configuration.projectClientRef)
          .first()
      : null);

  await loadKrtoZip(file, {
    loadDataToScopeId: scopeId,
    ...(existingProject && { loadDataToProjectId: existingProject.id }),
    // The zip may ship a stale name / number (project renamed after the
    // push): the scopeConfiguration metadata (projectName / projectNum) is
    // the reference.
    projectOverrides: {
      name: configuration.projectName,
      clientRef: configuration.projectClientRef,
      type: configuration.projectType,
    },
  });

  notify("importing", 95);

  const scope = await db.scopes.get(scopeId);

  return { configuration, scope };
}
