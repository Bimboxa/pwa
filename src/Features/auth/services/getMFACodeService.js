export default async function getMFACodeService({ phoneNumber }) {
  const body = JSON.stringify({
    UserName: "",
    Password: "",
    PhoneNumber: phoneNumber,
    ApplicationName: "krto",
  });

  async function fetchMFACode() {
    try {
      const response = await fetch("https://auth.etandex.fr/api/Auth/Login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });
      console.log("response", response);
    } catch (error) {
      console.error("Error:", error);
    }
  }

  await fetchMFACode();
}
