import { useSelector } from "react-redux";

export default function useToken() {
  const token = useSelector((s) => s.auth.token);

  return token;
}
