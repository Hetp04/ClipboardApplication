import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

export const useClipboardDebug = () => {
  useEffect(() => {
    const unlisten = listen<string>("clipboard-new-text", (e) => {
      // eslint-disable-next-line no-console
      console.log("📋 New clipboard text →", e.payload);
    });

    // Clean up listener when component unmounts
    return () => {
      unlisten.then(unlistenFn => unlistenFn());
    };
  }, []);
}; 