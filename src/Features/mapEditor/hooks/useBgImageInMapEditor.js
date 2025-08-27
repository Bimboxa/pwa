import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ImageObject from "Features/images/js/ImageObject";

export default function useBgImageInMapEditor() {
  // data

  const appConfig = useAppConfig();
  const bgImageKey = useSelector((s) => s.mapEditor.bgImageKey);

  // helpers

  const _bgImages = appConfig?.features?.baseMapViews?.bgImages;

  const _bgImage = _bgImages?.find((_bgImage) => _bgImage.key === bgImageKey);

  console.log("_bgImage", _bgImages, bgImageKey);

  // return

  if (!_bgImage) return null;

  const { url, width, height } = _bgImage;

  return new ImageObject({ imageUrlRemote: url, imageSize: { width, height } });
}
