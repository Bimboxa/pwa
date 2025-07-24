const fetchUrl = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network response was not ok");
    return await response.json();
  } catch (e) {
    console.error("error", e);
  }
};

export async function fetchMasterProjectsService() {
  const url = `http://localhost:8000/Chantiers/GetActifsList`;
  return await fetchUrl(url);
}

export async function fetchMasterProjectPhotosService({ id }) {
  const url = `http://localhost:8000/Chantiers/GetPhotoList?id=${id}`;
  return await fetchUrl(url);
}

export async function getStaffFromSIdentifiant({ id, apiToken }) {
  if (!id || !apiToken) throw new Error("Both id and apiToken are required");
  const url = `https://data.etandex.fr/cold/Staffs/GetFromSIdentifiant?apiToken=${encodeURIComponent(
    apiToken
  )}&id=${encodeURIComponent(id)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Network response was not ok");
  return await response.json();
}
