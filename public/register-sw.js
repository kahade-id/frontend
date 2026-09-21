if ("serviceWorker" in navigator) {
  // I-06 (audit 2026-09-20): sw.js memakai skipWaiting(), jadi worker baru
  // mengambil alih di tengah sesi. controllerchange = momen kendali berganti;
  // app (root layout) mengubahnya menjadi toast "Versi baru tersedia — muat
  // ulang" agar pengguna tidak mencampur aset lama/baru tanpa sadar.
  //
  // Kunjungan PERTAMA (controller null saat load): controllerchange pertama
  // hanyalah klaim awal — bukan update, jangan diumumkan. Kunjungan berikutnya
  // halaman sudah terkontrol sejak load, sehingga controllerchange apa pun
  // berarti worker baru menggantikan yang lama = update nyata.
  let pendingFirstControl = !navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (pendingFirstControl) {
      pendingFirstControl = false
      return
    }
    window.dispatchEvent(new CustomEvent("kahade:sw-updated"))
  })

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Offline shell is an enhancement; web app tetap berjalan tanpa SW.
    })
  })
}
