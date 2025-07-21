import decodeJWT from "./decodeJWT";

export default async function verifyMFACodeService({
  phoneNumber,
  mfaCode,
  serviceUrl,
}) {
  const body = JSON.stringify({
    UserName: "",
    Password: mfaCode,
    PhoneNumber: phoneNumber,
    ApplicationName: "krto",
  });

  async function verifyMFACode() {
    try {
      const response = await fetch(serviceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });
      if (response.ok) {
        const data = await response.json();
        return data.token;
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  return await verifyMFACode();
}
