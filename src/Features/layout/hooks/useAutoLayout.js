import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setOnboardingIsActive } from "Features/onboarding/onboardingSlice";
import { setOpenLeftPanel } from "Features/leftPanel/leftPanelSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

export default function useAutoLayout() {
  const dispatch = useDispatch();

  // data

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
    // if (!projectId) {
    //   setStep("PROJECT");
    // } else if (!scopeId) {
    //   setStep("SCOPE");
    // } else if (!presetListingsKeys) {
    //   setStep("LISTINGS");
    // } else if (!baseMap?.id) {
    //   setStep("BASE_MAP");
    // } else {
    //   setStep("END");
    // }
    if (!projectId) {
      setStep("PROJECT");
    } else if (!baseMap?.id) {
      setStep("BASE_MAP");
    } else if (!presetListingsKeys) {
      setStep("LISTINGS");
    } else {
      setStep("END");
    }
  }, [projectId, scopeId, presetListingsKeys?.length, baseMap?.id]);
  // effect

  useEffect(() => {
    if (step === "PROJECT" || step === "SCOPE") {
      dispatch(setOpenLeftPanel(false));
      dispatch(setSelectedMenuItemKey(null));
    } else if (step === "LISTINGS") {
      dispatch(setOpenLeftPanel(true));
    } else if (step === "END") {
      dispatch(setOnboardingIsActive(false));
    }
  }, [step]);
}
