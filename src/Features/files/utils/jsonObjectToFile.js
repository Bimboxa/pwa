export default function jsonObjectToFile(jsonObject) {
  try {
    const jsonString = JSON.stringify(jsonObject); // Pretty print with 2-space indentation
    const blob = new Blob([jsonString], {type: "application/json"});
    return blob;
  } catch (error) {
    console.error("Failed to convert JSON object to file:", error);
    throw error;
  }
}
