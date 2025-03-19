const API_URL = import.meta.env.VITE_WORKER_URL_SERVICES_CREDENTIALS;

export async function fetchServicesCredentials(token) {
  const response = await fetch(API_URL, {
    method: "GET",
    mode: "cors",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  //
  console.log("[fetchServicesCredentials] data:", data);
  //
  return data;
}
