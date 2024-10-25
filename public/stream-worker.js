import { Stream } from "/src/stream.js";
import { STREAM_URL } from "../src/CONSTANTS.js";

let stream;

self.addEventListener("message", (event) => {
  const { token, command } = event.data;

  if (command === "start") {
    stream = new Stream({
      render: (img) => self.postMessage(img),
      url: STREAM_URL,
      token,
    });
    stream.getFrame();
  } else {
    if (stream) {
      stream.close();
    }
  }
});
