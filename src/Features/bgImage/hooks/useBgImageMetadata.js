import { useSelector } from "react-redux";
import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";

export default function useBgImageMetadata() {
  // data

  const bgImageInMapEditor = useBgImageInMapEditor();
  const rawAnnotations = useSelector(
    (s) => s.bgImage.bgImageRawTextAnnotations
  );

  // edge

  if (!Array.isArray(bgImageInMapEditor?.textAnnotations)) return null;

  // main

  const metadata = bgImageInMapEditor?.textAnnotations?.map(
    (textAnnotation) => {
      return { ...textAnnotation, value: rawAnnotations[textAnnotation.key] };
    }
  );

  return metadata;
}
