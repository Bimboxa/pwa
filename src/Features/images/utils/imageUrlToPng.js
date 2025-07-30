export default async function imageUrlToPng({ url, name }) {
  if (!url) return;

  name = name ?? "image.png";

  const response = await fetch(url);
  const blob = await response.blob();

  return new File([blob], name, { type: "image/png" });
}
