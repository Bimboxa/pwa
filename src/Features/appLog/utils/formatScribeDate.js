/**
 * Formats a Date into the string format expected by the Scribe API:
 * "dd/MM/yyyy HH:mm:ss" (e.g. "18/12/2025 15:00:00").
 *
 * @param {Date} date
 * @returns {string}
 */
export default function formatScribeDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");

  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}
