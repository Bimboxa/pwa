import { useState, useEffect } from "react";

const LOGO_LOADERS = import.meta.glob("../../appConfig/assets/logo_*.png", {
  as: "url",
  eager: false,
});

const configCode = import.meta.env.VITE_CONFIG_CODE;

export default function useOrgaLogoUrl() {
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    if (!configCode) return;
    const key = `../../appConfig/assets/logo_${configCode}.png`;
    const loader = LOGO_LOADERS[key];
    if (loader) {
      loader().then(setLogoUrl).catch(() => setLogoUrl(null));
    }
  }, []);

  return logoUrl;
}