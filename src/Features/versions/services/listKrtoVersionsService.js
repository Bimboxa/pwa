export default async function listKrtoVersionsService({ orgaCode, projectId }) {
  const API = "https://public.media.bimboxa.com";
  const typeCode = "krtoVersions";

  try {
    const response = await fetch(
      `${API}/media-info?orgaCode=${orgaCode}&typeCode=${typeCode}&projectId=${projectId}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list media: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error listing media:", error);
    throw error;
  }
}
