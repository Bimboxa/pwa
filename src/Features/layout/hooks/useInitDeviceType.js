import {useEffect} from "react";

import {useDispatch} from "react-redux";

import {setDeviceType} from "../layoutSlice";

import {useMediaQuery} from "@mui/material";
import theme from "Styles/theme";

export default function useInitDeviceType() {
  const dispatch = useDispatch();

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  useEffect(() => {
    dispatch(setDeviceType(isMobile ? "MOBILE" : "DESKTOP"));
  }, [dispatch, isMobile]);
}
