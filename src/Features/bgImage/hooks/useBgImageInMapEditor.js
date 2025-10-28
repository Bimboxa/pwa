import { useSelector } from "react-redux";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useBgImageInMapEditor() {
  const appConfig = useAppConfig();
  const bgImages = appConfig?.features?.bgImages;
  const key = useSelector((s) => s.bgImage.bgImageKeyInMapEditor);

  return bgImages?.find((bgImage) => key === bgImage.key);
}
