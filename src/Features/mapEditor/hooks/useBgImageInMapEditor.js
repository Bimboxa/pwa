import { useMemo } from "react";
import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useBgImageInMapEditor() {
  // data

  const appConfig = useAppConfig();
  const bgImageKey = useSelector((s) => s.bgImage.bgImageKeyInMapEditor);

  // memoize to avoid creating new object references on every render

  return useMemo(() => {
    const _bgImages = appConfig?.features?.bgImages?.options;
    const _bgImage = _bgImages?.find((bg) => bg.key === bgImageKey);
    if (!_bgImage) return null;
    const { width, height } = _bgImage;
    return { ..._bgImage, imageSize: { width, height } };
  }, [appConfig, bgImageKey]);
}
