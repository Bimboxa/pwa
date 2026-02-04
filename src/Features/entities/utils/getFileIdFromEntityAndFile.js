export default function getFileIdFromEntityAndFile({ entityId, file, key }) {
  const fileExtension = file.name.split(".").pop();

  const fileId = `${key}_${entityId}.${fileExtension}`;

  return fileId;
}
