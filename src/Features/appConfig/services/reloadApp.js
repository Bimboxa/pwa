export default function reloadApp() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      })
      .finally(() => {
        window.location.reload(); // force reload
      });
  } else {
    window.location.reload();
  }
}
