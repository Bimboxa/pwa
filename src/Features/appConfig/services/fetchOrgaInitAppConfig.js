export default async function fetchOrgaInitAppConfigService({accessToken}) {
  const url = import.meta.env.VITE_WORKER_URL_ORGA_APP_CONFIG;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (response.ok) {
    try {
      const appConfig = await response?.json();
      console.log("[fetchOrgaAppConfig] appConfig", appConfig);
      return appConfig;
    } catch (e) {
      console.log("error response", response, e);
    }
  }
}
