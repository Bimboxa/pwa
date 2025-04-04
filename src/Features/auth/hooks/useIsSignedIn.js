import {useUser} from "@clerk/clerk-react";

export default function isSignedIn() {
  const {isSignedIn} = useUser();
  return isSignedIn;
}
