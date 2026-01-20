import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { setOnboardingIsActive } from "Features/onboarding/onboardingSlice";
import { setOpenLeftPanel } from "Features/leftPanel/leftPanelSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { setOpenedPanel } from "Features/listings/listingsSlice";

export default function useAutoLayout() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const baseMap = useMainBaseMap();
  const presetListingsKeys = useSelector(
    (s) => s.onboarding.presetListingsKeys
  );
  const { value: listing } = useSelectedListing();

  // state

  const [step, setStep] = useState("PROJECT"); // PROJECT, SCOPES, LISTINGS


  // left panel

  useEffect(() => {
    if (listing?.entityModel?.type === "BASE_MAP") {
      dispatch(setOpenedPanel("BASE_MAP_DETAIL"));
    }
  }, [listing?.id]);

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
      //dispatch(setOpenLeftPanel(false));
      dispatch(setSelectedMenuItemKey(null));
    } else if (step === "LISTINGS") {
      //dispatch(setOpenLeftPanel(true));
    } else if (step === "END") {
      dispatch(setOnboardingIsActive(false));
    }
  }, [step]);
}
