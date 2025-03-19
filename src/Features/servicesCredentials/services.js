const API_URL = import.meta.env.VITE_WORKER_URL_SERVICES_CREDENTIALS;

export async function fetchServicesCredentials(token) {
  try {
    console.log("[fetchServicesCredentials] data0:", response);
    const response = await fetch(API_URL, {
      method: "GET",
      mode: "cors",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    console.log("[fetchServicesCredentials] data1:", response);
    //
    const data = await response.json();
    //
    console.log("[fetchServicesCredentials] data2:", data);
    //
    return data;
  } catch (err) {
    console.error("[fetchServicesCredentials] error:", err);
  }
}
