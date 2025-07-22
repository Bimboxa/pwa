import { jwtDecode } from "jwt-decode";

export default function decodeJWT(jwt) {
  try {
    const decoded = jwtDecode(jwt);
    return decoded;
  } catch (error) {
    console.error("Error decoding JWT:", error, "jwt", jwt);
    return null;
  }
}
