import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useAnnotationSpriteImage() {
  const appConfig = useAppConfig();
  return appConfig?.features?.annotations?.spriteImages?.[0];
}
