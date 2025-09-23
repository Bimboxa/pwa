import { useSelector } from "react-redux";
import useBgImageMetadata from "./useBgImageMetadata";

export default function useBgImageFormItem() {
  // data

  const show = useSelector((s) => s.bgImage.showBgImageInMapEditor);
  const imageKey = useSelector((s) => s.bgImage.bgImageKeyInMapEditor);
  const metadata = useBgImageMetadata();

  // return

  return { show, imageKey, metadata };
}
