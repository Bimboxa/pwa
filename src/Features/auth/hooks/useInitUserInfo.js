import { useEffect } from "react";

import { useDispatch } from "react-redux";

import { setUserInfo } from "../authSlice";

import getUserInfoFromLocalStorage from "../services/getUserInfoFromLocalStorage";

export default function useInitUserInfo() {
  const dispatch = useDispatch();

  const userInfo = getUserInfoFromLocalStorage();

  useEffect(() => {
    dispatch(setUserInfo(userInfo));
  }, []);
}
