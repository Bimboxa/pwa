export default function stringifyFileSize(fileSize) {
  if (fileSize == null || isNaN(fileSize)) return "";
  if (fileSize > 1000 * 1024 * 1024) {
    return (fileSize / (1024 * 1024 * 1024)).toFixed(1) + " Go";
  }
  if (fileSize < 1024 * 1024) {
    // less than 1 Mo, show in Ko
    return (fileSize / 1024).toFixed(1) + " Ko";
  } else {
    // 1 Mo or more, show in Mo
    return (fileSize / (1024 * 1024)).toFixed(1) + " Mo";
  }
}
