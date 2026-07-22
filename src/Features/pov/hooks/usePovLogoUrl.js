import { useSelector } from "react-redux";

// Logo stamped bottom-right of the POV capture frame.
//
// `features.pov.logoUrl` (org override, resolved from `pov.logoPath` by
// resolveAppConfig) else the portfolio's default logo — the POV stamp is the
// same logo as the portfolio header unless an org says otherwise. Null when
// the org configures neither, and the "Logo" option then stays hidden.
export default function usePovLogoUrl() {
  return useSelector(
    (s) =>
      s.appConfig.value?.features?.pov?.logoUrl ??
      s.appConfig.value?.features?.portfolios?.logoDefault?.url ??
      null
  );
}
