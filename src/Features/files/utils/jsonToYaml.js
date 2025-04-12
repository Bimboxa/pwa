import yaml from "js-yaml";

export default function jsonToYaml(json) {
  try {
    const yamlString = yaml.dump(json);
    const blob = new Blob([yamlString], {type: "text/yaml"});
    return blob;
  } catch (error) {
    console.log("[jsonToYamlAsync] error", error);
  }
}
