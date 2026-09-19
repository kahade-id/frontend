if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Offline shell is an enhancement; web app tetap berjalan tanpa SW.
    })
  })
}
