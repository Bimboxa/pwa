export default function getFileCoreNameAndExtension(fileName) {
  // edge case
  if (!fileName) return {coreName: null, extension: null};

  // data
  const fileParts = fileName.split(".");
  const extension = fileParts.pop();
  const coreName = fileParts.join(".");

  // response
  return {coreName, extension};
}
