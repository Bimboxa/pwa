/**
 * Extract key from path using a template like "_listing_{{id}}.json"
 */

export default function extractKeyFromTemplate(inputString, template, key) {
  if (!template.includes(`{{${key}}}`)) return null;

  // Échappe tous les caractères spéciaux dans le template
  const escapedTemplate = template.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");

  // Remplace {{key}} par un groupe de capture
  const regexString = escapedTemplate.replace(`\\{\\{${key}\\}\\}`, "(.*?)");

  const regex = new RegExp(`^${regexString}$`);
  const match = inputString.match(regex);
  return match?.[1] || null;
}
