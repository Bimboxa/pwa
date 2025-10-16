import { useState, useEffect } from "react";

import { useSelector } from "react-redux";

import { IconButton, Avatar } from "@mui/material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import DialogSignin from "./DialogSignin";
import DialogUserProfile from "./DialogUserProfile";

import getAvatarStringFromUserProfile from "../utils/getAvatarStringFromUserProfile";

export default function ButtonSigninV2() {
  // strings

  const label = "S'identifier";

  // state

  const [openSignin, setOpenSignin] = useState(false);
  const [openUserProfile, setOpenUserProfile] = useState(false);

  // data

  const userProfile = useSelector((s) => s.auth.userProfile);
  const onboardingIsActive = useSelector(
    (s) => s.onboarding.onboardingIsActive
  );

  // helper

  const userName = userProfile?.userName;
  const avatarS = getAvatarStringFromUserProfile(userProfile);

  // effect

  useEffect(() => {
    if (!userName) {
      //setOpenSignin(true);
    }
  }, [userName, onboardingIsActive]);

  // handlers

  function handleClick() {
    setOpenSignin(true);
  }

  function handleClose() {
    setOpenSignin(false);
  }

  // render

  if (!userName)
    return (
      <>
        <ButtonGeneric
          label={label}
          onClick={handleClick}
          variant="contained"
          color="secondary"
          size="small"
        />
        <DialogSignin open={openSignin} onClose={handleClose} />
      </>
    );

  return (
    <>
      <IconButton onClick={() => setOpenUserProfile(true)} size="small">
        <Avatar sx={{ width: 32, height: 32 }}>{avatarS}</Avatar>
      </IconButton>
      <DialogUserProfile
        open={openUserProfile}
        onClose={() => setOpenUserProfile(false)}
      />
    </>
  );
}
