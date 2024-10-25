import React, { useEffect } from "react";
import { TOKEN } from "./CONSTANTS.js";

const imgId = "stream-image-id";

export const App = () => {
  // create worker which fetches streams and returns objectUrls for displaying
  // in image tag
  useEffect(() => {
    const img = document.getElementById(imgId);
    const worker = new Worker(
      new URL("/public/stream-worker.js", import.meta.url),
    );
    worker.addEventListener("message", (message) => {
      img.onload = () => URL.revokeObjectURL(message.data);
      img.src = message.data;
    });
    worker.postMessage({ command: "start", token: TOKEN });

    return () => {
      if (worker) {
        worker.postMessage({ command: "close" });
      }
    };
  }, []);

  return (
    <>
      <h1>Authorized Stream Viewer</h1>
      <img id={imgId} alt={"stream-viewer"} />
    </>
  );
};
