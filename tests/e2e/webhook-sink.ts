import http from "node:http";

/** Tiny local HTTP server that records webhook deliveries during a test. */
export async function startWebhookSink(port: number) {
  const received: { headers: http.IncomingHttpHeaders; body: any; raw: string }[] = [];
  const server = http.createServer((req, res) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        received.push({ headers: req.headers, body: JSON.parse(data), raw: data });
      } catch {
        received.push({ headers: req.headers, body: data, raw: data });
      }
      res.writeHead(200).end("ok");
    });
  });
  await new Promise<void>((r) => server.listen(port, r));
  return { url: `http://localhost:${port}/hook`, received, close: () => new Promise((r) => server.close(r)) };
}
