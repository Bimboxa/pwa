export async function fetchMasterProjectsService() {
  await fetch();
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
