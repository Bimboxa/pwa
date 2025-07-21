import decodeJWT from "./decodeJWT";

export default async function verifyMFACodeService({ phoneNumber, mfaCode }) {
  const body = JSON.stringify({
    UserName: "",
    Password: mfaCode,
    PhoneNumber: phoneNumber,
    ApplicationName: "krto",
  });

  async function verifyMFACode() {
    try {
      const response = await fetch(
        "https://auth.etandex.fr/api/Auth/CheckMfaCode",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body,
        }
      );
      if (response.ok) {
        const data = await response.json();
        return data.token;
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  await verifyMFACode();
}
