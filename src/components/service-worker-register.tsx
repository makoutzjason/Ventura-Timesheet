"use client";

import { useEffect } from "react";

// Registers public/sw.js. This alone (plus the manifest) is what makes
// Chrome/Android offer "Add to Home Screen" / the PWA install prompt.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    }
  }, []);

  return null;
}
