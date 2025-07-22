import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";

export default function useToken() {
  const { getToken } = useAuth();

  const [token, setToken] = useState(null);

  async function fetchToken() {
    try {
      const token = await getToken();
      setToken(token);
    } catch (err) {
      console.error("Error during token fetching:", err);
    }
  }

  useEffect(() => {
    fetchToken();
  }, []);

  return token;
}
