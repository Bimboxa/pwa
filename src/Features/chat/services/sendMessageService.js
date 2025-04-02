export default async function sendMessageService({
  messages,
  tools,
  store,
  accessToken,
}) {
  const url = import.meta.env.VITE_WORKER_URL_OPENAI;
  console.log("[sendMessageService] url", url, messages);

  const body = {
    //model: "gpt-3.5-turbo-1106", //gpt-3.5-turbo-1106, gpt-4o
    model: "gpt-4o",
    messages,
    tools,
    store,
    accessToken,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  return data;
}
