import http from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const publicFiles = new Set(["index.html", "styles.css", "app.js"]);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ttf": "font/ttf",
  ".pdf": "application/pdf",
};

const server = http.createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }
  let relative;
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    relative = pathname === "/" ? "index.html" : pathname.slice(1);
  } catch {
    response.writeHead(400).end("Invalid path");
    return;
  }
  if ((!publicFiles.has(relative) && !relative.startsWith("assets/")) ||
      relative.split(/[\\/]/).some((segment) => segment === "..") || relative.includes("\0")) {
    response.writeHead(404).end("Not found");
    return;
  }
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Content-Length": info.size,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    const stream = createReadStream(file);
    stream.on("error", (error) => {
      console.error("Could not serve file:", error.message);
      response.destroy(error);
    });
    stream.pipe(response);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      response.writeHead(404).end("Not found");
      return;
    }
    console.error("Could not read requested file:", error.message);
    response.writeHead(500).end("Could not read file");
  }
});

server.on("error", (error) => {
  console.error(`Could not start the invitation server: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Invitation ready at http://localhost:${port}`);
});
