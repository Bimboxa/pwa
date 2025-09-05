import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ImageObject from "Features/images/js/ImageObject";

export default function useBgImagesFromAppConfig() {
  // data

  const appConfig = useAppConfig();

  // helpers

  const _bgImages = appConfig?.features.baseMapViews.bgImages;

  if (!Array.isArray(_bgImages)) return;

  // return

  return _bgImages.map(
    ({ imageUrlRemote, width, height }) =>
      new ImageObject({ imageUrlRemote, imageSize: { width, height } })
  );
}
