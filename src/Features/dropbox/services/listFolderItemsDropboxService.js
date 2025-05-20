import createDbx from "./createDbx";

export default async function listFolderItemsDropboxService({
  path,
  accessToken,
  options,
}) {
  try {
    const dbx = createDbx({accessToken, options});
    const result = await dbx.filesListFolder({path}); // Dossier racine
    // Retourne la liste des entrées (fichiers et dossiers)
    return result.result.entries;
  } catch (e) {
    console.log("e", e);
  }
}
