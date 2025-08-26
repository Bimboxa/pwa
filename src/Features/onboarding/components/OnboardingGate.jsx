import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import getIsOnboardedFromLocalStorage from "../services/getIsOnboardedFromLocalStorage";
import setIsOnboardedInLocalStorage from "../services/setIsOnboardedInLocalStorage";

export default function OnboardingGate({ children }) {
  const navigate = useNavigate();

  // effect

  const isOnboarded = getIsOnboardedFromLocalStorage();

  useEffect(() => {
    if (!isOnboarded) {
      navigate("/onboarding");
      setIsOnboardedInLocalStorage("true");
    }
  }, [isOnboarded]);

  return <>{children}</>;
}
