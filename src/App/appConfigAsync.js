import exampleAppConfig from "./Data/exampleAppConfig";

const appConfigAsync = new Promise((resolve) => {
  resolve(exampleAppConfig);
});

return appConfigAsync;
