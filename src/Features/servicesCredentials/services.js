const API_URL = import.meta.env.VITE_WORKER_URL_SERVICES_CREDENTIALS;

export async function fetchServicesCredentialsService(token) {
  try {
    console.log("[fetchServicesCredentials] data0:");

    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      //credentials: "include",
    });

    //
    let data;
    if (response.ok) {
      data = await response.json();
    }
    //
    console.log("[fetchServicesCredentials] data", data);
    //
    return data;
  } catch (err) {
    console.error("[fetchServicesCredentials] error:", err);
  }
}
