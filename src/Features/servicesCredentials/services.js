const API_URL = import.meta.env.VITE_WORKER_URL_SERVICES_CREDENTIALS;

// ------------------------------------
// CREATE OR UPDATE
// ------------------------------------

export async function createOrUpdateServiceCredentialService({
  key,
  prefix,
  value,
  token,
}) {
  // serviceCredential: {key, prefix,value}
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({key, prefix, value}),
    });
    return {key, value};
  } catch (err) {
    console.error("[createServiceCredential] error:", err);
  }
}

// ------------------------------------
// FETCH
// ------------------------------------

export async function fetchServiceCredentialService({key, prefix, token}) {
  console.log("[FetchServiceCredentialService]", key, prefix);
  try {
    const url = `${API_URL}?key=${key}&prefix=${prefix}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    //
    let data;
    console.log("response", response);
    if (response.ok) {
      const keyValue = await response?.json();
      console.log("[fetchServicesCredentials] data", keyValue);
      data = {key, prefix, value: keyValue.value};
    }
    //

    //
    return data;
  } catch (err) {
    console.error("[fetchServicesCredentials] error:", err);
  }
}

// ------------------------------------
// DELETE
// ------------------------------------

export async function deleteServiceCredentialService({key, prefix, token}) {
  try {
    const url = `API_URL?key=${key}&prefix=${prefix}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    //
    return key;
  } catch (err) {
    console.error("[deleteServiceCredential] error:", err);
  }
}
