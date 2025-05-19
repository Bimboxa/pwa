export default function getDateString(date) {
  try {
    return new Date(date).toISOString().replace(/\.\d{3}Z$/, "Z");
  } catch (e) {
    console.error("[getDateString]", date, e);
  }
}
