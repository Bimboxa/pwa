import readLocalScanInWorker from "./readLocalScanInWorker";
import { isAsciiPly } from "../utils/convertAsciiPlyToBinary";

// The points decoder and the stored scan resource are binary-only: an ASCII
// PLY is converted once, at import. A binary file is returned as is.
export default async function ensureBinaryLocalPly(
  file,
  { signal, onProgress } = {}
) {
  if (!(await isAsciiPly(file))) return file;
  return readLocalScanInWorker(file, { signal, onProgress, convert: true });
}
