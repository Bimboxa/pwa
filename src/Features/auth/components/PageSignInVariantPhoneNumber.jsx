import { useState } from "react";

import { useNavigate } from "react-router-dom";

import { Typography, TextField, Button, Box } from "@mui/material";
import BoxCenter from "Features/layout/components/BoxCenter";
import PageGeneric from "Features/layout/components/PageGeneric";
import FieldPhoneNumber from "Features/form/components/FieldPhoneNumber";
import SectionStepMFACode from "./SectionStepMFACode";
import SectionStepPhoneNumber from "./SectionStepPhoneNumber";
import getMFACodeService from "../services/getMFACodeService";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BoxFlexHStretch from "Features/layout/components/BoxFlexHStretch";
import ImageAnimatedMap from "Features/onboarding/components/ImageAnimatedMap";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import getUserInfoFromJwt from "../services/getUserInfoFromJwt";
import setUserInfoInLocalStorage from "../services/setUserInfoInLocalStorage";

export default function PageSignInVariantPhoneNumber() {
  const navigate = useNavigate();

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
    setUserInfoInLocalStorage(userInfo);
    navigate("/");
  }

  return (
    <PageGeneric>
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
