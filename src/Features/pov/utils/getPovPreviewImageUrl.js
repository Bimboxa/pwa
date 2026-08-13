import resolveUrl from "Features/appConfig/utils/resolveUrl";
import resolveRoute from "Features/remoteScopeConfigurations/utils/resolveRoute";

// Rebuild a POV preview image url from its povId via the appConfig
// features.povPreviews.getImage route. The backend povImageUrl is absolute
// (cross-origin → CORS); this one goes through the proxy baseUrl instead.
// Returns null when the config or povId is missing.
export default function getPovPreviewImageUrl({ appConfig, povId }) {
  const fetchParams = appConfig?.features?.povPreviews?.getImage?.fetchParams;
  if (!fetchParams?.url || !povId) return null;

  const urlConfig = {
    ...fetchParams.url,
    route: resolveRoute(fetchParams.url.route, { povId }),
  };
  return resolveUrl(urlConfig);
}
