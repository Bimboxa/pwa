import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import getIsOnboardedFromLocalStorage from "../services/getIsOnboardedFromLocalStorage";
import setIsOnboardedInLocalStorage from "../services/setIsOnboardedInLocalStorage";

export default function OnboardingGate({ children }) {
  const navigate = useNavigate();
  const isDownloadPage = window.location.pathname.includes("/download/");

  // effect

  const isOnboarded = getIsOnboardedFromLocalStorage();

  useEffect(() => {
    if (!isOnboarded && !isDownloadPage) {
      navigate("/onboarding");
      setIsOnboardedInLocalStorage("true");
    } else if (isDownloadPage && !isOnboarded) {
      setIsOnboardedInLocalStorage("true");
    }
  }, [isOnboarded, isDownloadPage]);

  return <>{children}</>;
}
