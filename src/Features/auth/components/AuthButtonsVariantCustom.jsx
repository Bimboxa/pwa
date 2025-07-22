import useIsSignedIn from "../hooks/useIsSignedIn";

import ButtonUserAvatar from "./ButtonUserAvatar";
import ButtonSignIn from "./ButtonSignIn";

export default function AuthButtonsVariantCustom() {
  const isSignedIn = useIsSignedIn();

  console.log("isSignedIn", isSignedIn);

  return isSignedIn ? <ButtonUserAvatar /> : <ButtonSignIn />;
}
