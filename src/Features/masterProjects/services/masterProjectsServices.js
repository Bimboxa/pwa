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
