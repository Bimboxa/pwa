import {useEffect, useState} from "react";

import appConfigAsync from "App/appConfigAsync";

export default function useAppConfig() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    appConfigAsync.then((config) => {
      setConfig(config);
    });
  }, []);

  return config;
}
