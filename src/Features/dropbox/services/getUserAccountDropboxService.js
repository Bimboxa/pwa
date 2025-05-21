import {Dropbox} from "dropbox";
import dropboxToGenericUserAccount from "../utils/dropboxToGenericUserAccount";

export default async function getUserAccountDropboxService({accessToken}) {
  try {
    const dbx = new Dropbox({accessToken});

    const response = await dbx.usersGetCurrentAccount();

    // Retourne la liste des entrées (fichiers et dossiers)
    const account = dropboxToGenericUserAccount(response?.result);
    return account;
  } catch (e) {
    console.log("e", e);
  }
}
