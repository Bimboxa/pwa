import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import getIsOnboardedFromLocalStorage from "../services/getIsOnboardedFromLocalStorage";
import setIsOnboardedInLocalStorage from "../services/setIsOnboardedInLocalStorage";

export default function OnboardingGate({ children }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // effect

  const isOnboarded = getIsOnboardedFromLocalStorage();
  const dataPath = searchParams.get("dataPath");

  useEffect(() => {
    if (!isOnboarded && !dataPath) {
      navigate("/onboarding");
      setIsOnboardedInLocalStorage("true");
    } else if (dataPath && !isOnboarded) {
      setIsOnboardedInLocalStorage("true");
    }
  }, [isOnboarded, dataPath]);

  return <>{children}</>;
}
