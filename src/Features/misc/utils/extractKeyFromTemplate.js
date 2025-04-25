/**
 * Extract key from path using a template like "_listing_{{id}}.json"
 */

export default function extractKeyFromTemplate(inputString, template, key) {
  if (!template.includes(`{{${key}}}`)) return null;
  const regex = template.replace(`{{${key}}}`, "(.*?)").replace(/\./g, "\\.");
  const match = inputString.match(new RegExp(regex));
  return match?.[1] || null;
}
