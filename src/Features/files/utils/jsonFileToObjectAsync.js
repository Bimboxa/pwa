export default function jsonFileToObjectAsync(jsonFile) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const jsonObject = JSON.parse(reader.result);
        resolve(jsonObject);
      } catch (error) {
        reject(new Error("Invalid JSON format: " + error.message));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read the file: " + reader.error));
    };

    reader.readAsText(jsonFile);
  });
}
