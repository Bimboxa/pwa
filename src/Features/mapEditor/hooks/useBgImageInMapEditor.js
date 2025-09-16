import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ImageObject from "Features/images/js/ImageObject";

export default function useBgImageInMapEditor() {
  // data

  const appConfig = useAppConfig();
  //const bgImageKey = useSelector((s) => s.mapEditor.bgImageKey);
  const bgImageKey = useSelector((s) => s.bgImage.bgImageKeyInMapEditor);

  // helpers

  const _bgImages = appConfig?.features?.bgImages?.options;

  const _bgImage = _bgImages?.find((_bgImage) => _bgImage.key === bgImageKey);

  // return

  if (!_bgImage) return null;

  const { url, width, height } = _bgImage;

  return { ..._bgImage, imageSize: { width, height } };

  // return new ImageObject({
  //   imageUrlRemote: url,
  //   url,
  //   imageSize: { width, height },
  // });
}
