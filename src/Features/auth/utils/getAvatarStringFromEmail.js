export default function getAvatarStringFromEmail(email) {
  if (!email || typeof email !== "string") return "";

  const namePart = email.split("@")[0];
  const nameSegments = namePart.split(/[\.\_\-]/); // Split on dot, underscore, dash

  // Take first letter of the first and last segment if available
  if (nameSegments.length >= 2) {
    return (
      nameSegments[0][0] + nameSegments[nameSegments.length - 1][0]
    ).toUpperCase();
  }

  // Fallback: take first two letters of the name part
  return namePart.substring(0, 2).toUpperCase();
}
