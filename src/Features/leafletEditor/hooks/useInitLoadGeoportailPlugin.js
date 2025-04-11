import {useEffect} from "react";

export default function useInitLoadGeoportailPlugin() {
  useEffect(() => {
    console.log("[EFFECT] useInitLoadGeoportailPlugin");

    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;

    document.body.appendChild(script);
  }, []);
}
