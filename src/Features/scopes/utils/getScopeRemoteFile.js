import jsonObjectToFile from "Features/files/utils/jsonObjectToFile";

export default function getScopeRemoteFile(scope) {
  const fileName = `scope::${scope.id}.json`;

  const blob = jsonObjectToFile(scope);

  const file = new File([blob], fileName, {
    type: "application/json",
  });

  return file;
}
