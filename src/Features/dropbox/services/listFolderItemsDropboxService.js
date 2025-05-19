import {Dropbox} from "dropbox";

export default async function listFolderItemsDropboxService({
  path,
  accessToken,
}) {
  try {
    const dbx = new Dropbox({accessToken});
    const result = await dbx.filesListFolder({path}); // Dossier racine
    // Retourne la liste des entrées (fichiers et dossiers)
    return result.result.entries;
  } catch (e) {
    console.log("e", e);
  }
}
