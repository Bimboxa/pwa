import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ImageObject from "Features/images/js/ImageObject";

export default function useBgImagesFromAppConfig() {
  // data

  const appConfig = useAppConfig();

  // helpers

  const _bgImages = appConfig?.features?.bgImages?.options;

  if (!Array.isArray(_bgImages)) return;

  // return

  return _bgImages.map(
    ({ url, width, height, key }) =>
      new ImageObject({ url, imageSize: { width, height }, key })
  );
}
