import { useEffect } from "react";

import { useDispatch } from "react-redux";

import { updateUserProfile } from "../authSlice";

import getUserProfileFromLocalStorage from "../services/getUserProfileFromLocalStorage";

export default function useInitUserProfile() {
  const dispatch = useDispatch();

  let userProfile = getUserProfileFromLocalStorage();
  userProfile = {
    ...(userProfile ?? {}),
    userName: userProfile?.userName ?? "Anonyme",
  };

  useEffect(() => {
    dispatch(updateUserProfile(userProfile));
  }, []);
}
