export default async function postOrgaAppConfigService({
  accessToken,
  appConfig,
}) {
  const url = import.meta.env.VITE_WORKER_URL_ORGA_APP_CONFIG;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(appConfig),
  });

  if (response.ok) {
    console.log("[postOrgaAppConfig] appConfig", appConfig);
    return appConfig;
  }
}
