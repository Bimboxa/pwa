import { useEffect } from "react";

import { useDispatch } from "react-redux";

import { setUserProfile } from "../authSlice";

import getUserProfileFromLocalStorage from "../services/getUserProfileFromLocalStorage";

export default function useInitUserProfile() {
  const dispatch = useDispatch();

  const userProfile = getUserProfileFromLocalStorage();

  useEffect(() => {
    dispatch(setUserProfile(userProfile));
  }, []);
}
