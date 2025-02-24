import yaml from "js-yaml";

export default function yamlToJsonAsync(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = yaml.load(reader.result);
        resolve(json);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsText(file);
  });
}
