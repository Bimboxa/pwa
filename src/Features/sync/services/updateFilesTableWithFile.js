import db from "App/db/db";

export default async function updateFilesTableWithFileAsync({
  table,
  file,
  path,
  folderTemplate,
  fileTemplate,
  context,
}) {
  const pathTemplate = folderTemplate + "/" + fileTemplate;
  const dynamicVariables = getDynamicVariablesFromTemplate(
    path,
    pathTemplate,
    context
  );
  const listingId = dynamicVariables["listingId"];
  const createdBy = dynamicVariables["createdBy"];
  const fileName = dynamicVariables["fileName"];

  const fileItem = {fileName, listingId, createdBy, file};

  await db[table].put(fileItem);
}
