export default function jsonObjectToFile(jsonObject, fileName) {
  try {
    const jsonString = JSON.stringify(jsonObject); // Pretty print with 2-space indentation

    if (fileName) {
      const file = new File([jsonString], fileName, {type: "application/json"});
      return file;
    } else {
      const blob = new Blob([jsonString], {type: "application/json"});
      return blob;
    }
  } catch (error) {
    console.error("Failed to convert JSON object to file:", error);
    throw error;
  }
}
