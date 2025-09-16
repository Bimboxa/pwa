import { useSelector } from "react-redux";

export default function useBgImageFormItem() {
  // data

  const show = useSelector((s) => s.bgImage.showBgImageInMapEditor);
  const imageKey = useSelector((s) => s.bgImage.bgImageKeyInMapEditor);

  // return

  return { show, imageKey };
}
