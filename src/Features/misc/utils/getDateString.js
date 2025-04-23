export default function getDateString(date) {
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, "Z");
}
