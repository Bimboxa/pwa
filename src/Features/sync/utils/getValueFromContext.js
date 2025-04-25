/*
 * express = "project.clientRef", "scope.listings", "project",...
 */

export default function getValueFromContext(express, context) {
  const value = express.split(".").reduce((acc, k) => acc?.[k], context);
  return value;
}
