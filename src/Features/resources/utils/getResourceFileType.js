import testIsPdf from "Features/pdf/utils/testIsPdf";
import testIsImage from "Features/files/utils/testIsImage";

// Resource fileType token: "PDF", "IMAGE", else the uppercased extension
// ("DWG", "IFC"…), "OTHER" when the name has no usable extension.
export default function getResourceFileType(file) {
  if (testIsPdf(file)) return "PDF";
  if (testIsImage(file)) return "IMAGE";
  const name = file?.name ?? "";
  const dotIndex = name.lastIndexOf(".");
  const extension = dotIndex > 0 ? name.slice(dotIndex + 1) : "";
  if (extension && extension.length <= 5) return extension.toUpperCase();
  return "OTHER";
}
