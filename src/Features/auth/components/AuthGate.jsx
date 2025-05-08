import {useEffect} from "react";

import {useDispatch} from "react-redux";

import {setUserEmail} from "../authSlice";
import {forceUpdate} from "Features/appConfig/appConfigSlice";

import {useClerk, useUser} from "@clerk/clerk-react";
import {useNavigate} from "react-router-dom";
import useNetworkStatus from "../hooks/useNetworkStatus";

import setUserEmailInLocalStorage from "../services/setUserEmailInLocalStorage";
import getUserEmailFromLocalStorage from "../services/getUserEmailFromLocalStorage";
import getEmailDomain from "../utils/getEmailDomain";
import setAppConfigInLocalStorage from "Features/appConfig/services/setAppConfigInLocalStorage";

const AuthGate = ({children}) => {
  const navigate = useNavigate();
  const isOnline = useNetworkStatus();
  const dispatch = useDispatch();

  const {user, isLoaded, userId} = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  useEffect(() => {
    console.log("[EFFECT] authGate");
    if (!email && isLoaded && isOnline) {
      setUserEmailInLocalStorage(null);
      navigate("/sign-in");
    }
  }, [email, isOnline, isLoaded]);

  useEffect(() => {
    console.log("[EFFECT] authGate 1", email, isOnline);
    if (email) {
      const prevEmail = getUserEmailFromLocalStorage();
      //
      const prevDomain = getEmailDomain(prevEmail);
      const domain = getEmailDomain(email);
      if (prevDomain !== domain) {
        setAppConfigInLocalStorage(null);
        dispatch(forceUpdate());
      }
      //
      setUserEmailInLocalStorage(email);
      dispatch(setUserEmail(email));
    }
    const userEmail = getUserEmailFromLocalStorage();
    console.log(
      "[EFFECT] authGate 2",
      !userEmail && isOnline,
      userEmail,
      isOnline
    );
    if (!userEmail && isOnline) {
      navigate("/sign-in"); // Redirects to Clerk sign-in page
    }
  }, [email]);

  return <>{children}</>;
};

export default AuthGate;
