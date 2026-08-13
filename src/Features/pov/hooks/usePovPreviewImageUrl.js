import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useRemoteImageUrl from "Features/misc/hooks/useRemoteImageUrl";

import getPovPreviewImageUrl from "../utils/getPovPreviewImageUrl";

// Object URL for a shared POV preview image. The url is rebuilt from the
// povId through the proxied getImage route (the backend imageUrlMaster is
// absolute → CORS); imageUrlMaster stays as a fallback when the org config
// has no getImage block.
export default function usePovPreviewImageUrl(povPreview) {
  const appConfig = useAppConfig();

  const url =
    getPovPreviewImageUrl({ appConfig, povId: povPreview?.idMaster }) ??
    povPreview?.imageUrlMaster;

  return useRemoteImageUrl(url);
}
