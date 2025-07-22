//import { useUser } from "@clerk/clerk-react";
import useToken from "../hooks/useToken";

export default function isSignedIn() {
  //const { isSignedIn } = useUser();

  const token = useToken();
  //console.log("token", token, Boolean(token));

  return Boolean(token);
}
