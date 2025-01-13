import "dotenv/config"
import http from "node:http"
import http2 from "node:http2"
import { readFile } from "node:fs/promises"
import { extname } from "node:path"
import { walk } from "@root/walk"

// 🗃️ Load everything in memory
const cache = new Map()
await walk("./dist/", async (err, path, file) => {
    if (err) throw err
    if (file.isFile()) cache.set(path.replace("dist", ""), await readFile(path))
})

const mime_types = new Map([
    [".html", "text/html"],
    [".js", "text/javascript"],
    [".css", "text/css"],
    [".json", "application/json"],
    [".webmanifest", "application/manifest+json"],
    [".png", "image/png"],
    [".jpg", "image/jpg"],
    [".webp", "image/webp"],
    [".gif", "image/gif"],
    [".svg", "image/svg+xml"],
    [".wav", "audio/wav"],
    [".mp4", "video/mp4"],
    [".woff2", "font/woff2"],
    [".wasm", "application/wasm"],
    [".md", "text/markdown"],
    [".txt", "text/plain"]
])

function handler(request, response) {
    if (request.method !== "GET") {
        response.writeHead(405)
        response.end("", "utf-8")
    }

    // 🔥 Sanitize
    const { pathname: path } = new URL(`http://localhost${encodeURI(request.url)}`)
    const accepted_encodings = request.headers["accept-encoding"]?.replace(/[^a-zA-Z0-9"#$%&'()*+,-./:;=?@[\]_ ]/g, "")

    // ♻️ Handle implicit index.html request
    let ext_name = String(extname(path)).toLowerCase()
    let file_path
    if (!ext_name) {
        file_path = path.endsWith("/") ? `${path}index.html` : `${path}/index.html`
        ext_name = ".html"
    }
    else file_path = path
    
    // 📝 Set file type
    const content_type = mime_types.get(ext_name) || "application/octet-stream"
    response.setHeader("Content-Type", content_type)

    // 🔀 Reroute for SPA
    if (process.env.SPA === "true" && content_type === "text/html") file_path = "/index.html"

    // 📦 Serve compressed file if possible
    let encoding = ""
    if ([".html", ".js", ".css"].includes(ext_name)) {
        if (accepted_encodings?.includes("br") && cache.has(file_path + ".br")) {
            encoding = ".br"
            response.setHeader("Content-Encoding", "br")
        }
        else if (accepted_encodings?.includes("gzip") && cache.has(file_path + ".gz")) {
            encoding = ".gz"
            response.setHeader("Content-Encoding", "gzip")
        }
    }
    
    // 🍱 Set cache policy
    if (content_type !== "text/html" &&
        content_type !== "application/manifest+json" &&
        content_type !== "text/markdown" &&
        !file_path.endsWith("sw.js")
    )
        response.setHeader("Cache-Control", "public, max-age=31536000, immutable")

    // 🚀 Serve file from cache
    if (cache.has(file_path + encoding))  {
        response.writeHead(200)
        response.end(cache.get(file_path + encoding), "utf-8")
    }
    else {
        response.writeHead(404)
        response.end("", "utf-8")
    }
}

if (process.env.CERT_PATH)
    http2.createSecureServer({
        cert: readFileSync(process.env.CERT_PATH + "cert.pem"),
        key: readFileSync(process.env.CERT_PATH + "privkey.pem"),
        allowHTTP1: true
    }, handler).listen(process.env.PORT)
else
    http.createServer(handler).listen(process.env.PORT)