import { useState } from "react";

import { useNavigate } from "react-router-dom";

import { useDispatch } from "react-redux";

import { setUserInfo, setToken } from "../authSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box } from "@mui/material";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import BoxCenter from "Features/layout/components/BoxCenter";
import PageGeneric from "Features/layout/components/PageGeneric";
import SectionStepMFACode from "./SectionStepMFACode";
import SectionStepPhoneNumber from "./SectionStepPhoneNumber";
import ImageAnimatedMap from "Features/onboarding/components/ImageAnimatedMap";

import getUserInfoFromJwt from "../services/getUserInfoFromJwt";
import setUserInfoInLocalStorage from "../services/setUserInfoInLocalStorage";
import setTokenInLocalStorage from "../services/setTokenInLocalStorage";

export default function PageSignInVariantPhoneNumber() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  // state

  const [step, setStep] = useState("PHONE_NUMBER"); // "PHONE_NUMBER", "MFA_CODE"
  const [phoneNumber, setPhoneNumber] = useState("");

  // handlers

  function handleSendPhoneNumberSuccess({ phoneNumber }) {
    setPhoneNumber(phoneNumber);
    setStep("CODE_MFA");
  }

  function handleVerifyMfaSuccess({ jwt }) {
    const userInfo = getUserInfoFromJwt({ appConfig, jwt });
    console.log("userInfo");
    dispatch(setUserInfo(userInfo));
    dispatch(setToken(jwt));

    navigate("/");
  }

  return (
    <PageGeneric>
      <IconButtonClose onClose={() => navigate("/")} position="top-right" />
      <Box sx={{ display: "flex", width: 1, height: 1 }}>
        <Box sx={{ width: 400, height: 1 }}>
          <ImageAnimatedMap />
        </Box>

        <Box sx={{ display: "flex", flexGrow: 1 }}>
          <BoxCenter>
            {step === "PHONE_NUMBER" && (
              <SectionStepPhoneNumber
                onSuccess={handleSendPhoneNumberSuccess}
              />
            )}
            {step === "CODE_MFA" && (
              <SectionStepMFACode
                phoneNumber={phoneNumber}
                onSuccess={handleVerifyMfaSuccess}
              />
            )}
          </BoxCenter>
        </Box>
      </Box>
    </PageGeneric>
  );
}
