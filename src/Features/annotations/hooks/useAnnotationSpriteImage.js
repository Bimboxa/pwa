import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import sprite_default from "App/assets/sprite_default.png";

export default function useAnnotationSpriteImage() {
  const appConfig = useAppConfig();

  const spriteProps = appConfig?.features?.annotations?.spriteImages?.[0] ?? {};

  return { ...spriteProps, url: sprite_default };
}
