import {Dropbox} from "dropbox";

export default async function getUserAccountDropboxService({accessToken}) {
  try {
    const dbx = new Dropbox({accessToken});
    const result = await dbx.usersGetCurrentAccount(); // Dossier racine
    // Retourne la liste des entrées (fichiers et dossiers)
    return result.result;
  } catch (e) {
    console.log("e", e);
  }
}
