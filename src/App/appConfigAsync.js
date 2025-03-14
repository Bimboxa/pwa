import exampleAppConfig from "App/Data/exampleAppConfig";

const appConfigAsync = new Promise((resolve) => {
  resolve(exampleAppConfig);
});

export default appConfigAsync;
