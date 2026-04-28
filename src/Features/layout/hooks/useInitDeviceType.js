import {useEffect} from "react";

import {useDispatch} from "react-redux";

import {setDeviceType} from "../layoutSlice";

import {useMediaQuery} from "@mui/material";
import theme from "Styles/theme";

export default function useInitDeviceType() {
  const dispatch = useDispatch();

  // Kept so the hook count stays stable across HMR; result intentionally ignored.
  useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    dispatch(setDeviceType("DESKTOP"));
  }, [dispatch]);
}
