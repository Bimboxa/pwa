export default async function imageUrlToPng({url, name}) {
  if (!url) return;

  const response = await fetch(url);
  const blob = await response.blob();

  return new File([blob], name, {type: "image/png"});
}
