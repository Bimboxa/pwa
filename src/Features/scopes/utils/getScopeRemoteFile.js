import jsonToYaml from "Features/files/utils/jsonToYaml";

export default function getScopeRemoteFile(scope) {
  const fileName = `scope::${scope.id}.yaml`;

  const blob = jsonToYaml(scope);

  const file = new File([blob], fileName, {
    type: "text/yaml",
  });

  return file;
}
