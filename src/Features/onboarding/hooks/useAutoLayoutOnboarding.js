import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setOpenLeftPanel } from "Features/leftPanel/leftPanelSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

export default function useAutoLayoutOnboarding() {
  const dispatch = useDispatch();

  // data

  const onboardingIsActive = useSelector(
    (s) => s.onboarding.onboardingIsActive
  );

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const baseMap = useMainBaseMap();
  const presetListingsKeys = useSelector(
    (s) => s.onboarding.presetListingsKeys
  );

  // state

  const [step, setStep] = useState("PROJECT"); // PROJECT, SCOPES, LISTINGS

  // effect - setStep

  useEffect(() => {
    if (!projectId) {
      setStep("PROJECT");
    } else if (!scopeId) {
      setStep("SCOPE");
    } else if (!presetListingsKeys) {
      setStep("LISTINGS");
    } else if (!baseMap?.id) {
      setStep("BASE_MAP");
    }
  }, [projectId, scopeId, presetListingsKeys?.length, baseMap?.id]);
  // effect

  useEffect(() => {
    if (onboardingIsActive) {
      if (step === "PROJECT" || step === "SCOPE") {
        dispatch(setOpenLeftPanel(false));
        dispatch(setSelectedMenuItemKey(null));
      } else if (step === "LISTINGS") {
        dispatch(setOpenLeftPanel(true));
      }
    }
  }, [onboardingIsActive, step]);
}
