export default async function getMFACodeService({ serviceUrl, phoneNumber }) {
  const body = JSON.stringify({
    UserName: "",
    Password: "",
    PhoneNumber: phoneNumber,
    ApplicationName: "krto",
  });

  async function fetchMFACode() {
    try {
      const response = await fetch(serviceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });
      if (response.ok) return phoneNumber;
    } catch (error) {
      console.error("Error:", error);
    }
  }

  return await fetchMFACode();
}
