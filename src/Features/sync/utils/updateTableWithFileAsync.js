import db from "App/db/db";

import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";

export default async function updateTableWithFileAsync({table, file}) {
  // edge case
  if (!table || !file) return null;

  // main
  try {
    const object = await jsonFileToObjectAsync(file);
    if (object?.data) {
      db[table].put(object.data);
    }
  } catch (e) {
    console.log("error writing in db", e);
  }
}
