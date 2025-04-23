import jsonObjectToFile from "Features/files/utils/jsonObjectToFile";

export default function getScopeRemoteFile(scope) {
  const fileName = `_scope_${scope.id}.json`;

  const file = jsonObjectToFile(scope, fileName);

  return file;
}
