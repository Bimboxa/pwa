import { useEffect } from "react";

import { useDispatch } from "react-redux";

import { setToken } from "../authSlice";

import getTokenFromLocalStorage from "../services/getTokenFromLocalStorage";

export default function useInitToken() {
  const dispatch = useDispatch();

  const token = getTokenFromLocalStorage();

  useEffect(() => {
    dispatch(setToken(token));
  }, []);
}
