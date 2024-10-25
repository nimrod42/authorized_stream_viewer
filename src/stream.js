export class Stream {
  constructor(options) {
    this.url = options.url;
    this.token = options.token;
    this.render = options.render;
    this.controller = new AbortController();
    this.abortSignal = this.controller.signal;
  }

  close() {
    this.controller.abort();
  }

  //current
  async getFrame() {
    const response = await fetch(this.url, {
      method: "GET",
      headers: { Authorization: this.token },
      cache: "no-cache",
      signal: this.abortSignal,
    });

    if (response.ok && response.body) {
      const contentType = response.headers.get("content-type");

      if (contentType.startsWith("multipart/x-mixed-replace;")) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let headers = "";
        let partType = "";
        let partLen = -1;
        let data = null;
        let readBytes = 0;
        let buffer = new Uint8Array(); // Buffer stores leftover data between reads

        while (true) {
          const { done, value } = await reader.read();
          if (done) break; // Finished with reading

          // Combine buffer data with new value
          const chunk = new Uint8Array(buffer.length + value.length);
          chunk.set(buffer);
          chunk.set(value, buffer.length);

          let offset = 0;

          while (offset < chunk.length) {
            // Read headers
            if (partLen === -1) {
              // Find JPEG start marker in the chunk
              for (let i = offset; i < chunk.length - 1; i++) {
                if (chunk[i] === 0xff && chunk[i + 1] === 0xd8) {
                  // Process headers
                  const headerString = decoder.decode(
                    chunk.subarray(offset, i),
                  );
                  headers += headerString; // Append any partial headers from previous reads

                  headers.split("\n").forEach((line) => {
                    const [key, val] = line
                      .split(":")
                      .map((s) => s.trim().toLowerCase());
                    if (key === "content-length") {
                      partLen = parseInt(val, 10);
                      data = new Uint8Array(partLen); // Allocate buffer for the image data
                    } else if (key === "content-type") {
                      partType = val;
                    }
                  });

                  offset = i; // Move offset to start of JPEG data
                  headers = ""; // Reset headers for next part
                  break;
                }
              }

              if (partLen === -1) {
                // No start marker found, keep accumulating headers
                headers += decoder.decode(chunk.subarray(offset));
                break;
              }
            }

            // Processing image data
            if (partLen > 0 && readBytes < partLen) {
              const bytesToRead = Math.min(
                partLen - readBytes,
                chunk.length - offset,
              );
              data.set(chunk.subarray(offset, offset + bytesToRead), readBytes);
              readBytes += bytesToRead;
              offset += bytesToRead;
            }

            // Process image by creating objectUrl and send it to main process
            if (readBytes === partLen) {
              let file = new Blob([data], { type: partType });
              if (file.type.startsWith("image")) {
                let objectUrl = URL.createObjectURL(file);
                this.render(objectUrl);
                setTimeout(() => {
                  URL.revokeObjectURL(objectUrl);
                  objectUrl = null;
                  file = null;
                }, 500);
              }
              // Reset for the next image
              readBytes = 0;
              partLen = -1;
              partType = "";
              data = null;
            }
          }

          // Save any remaining unprocessed data in the buffer
          if (offset < chunk.length) {
            buffer = chunk.subarray(offset);
          } else {
            buffer = new Uint8Array(); // Reset buffer if everything was processed
          }
        }
      }
    }
  }
}
