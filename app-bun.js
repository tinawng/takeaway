import { extname } from "path"
import { walk } from "@root/walk"

// 🗃️ Load everything in memory
const files = new Set()
await walk("./dist/", async (err, path, file) => {
    if (err) throw err
    if (file.isFile()) files.add(path.replace("dist", ""))
    
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

export default {
    port: process.env.PORT,
    async fetch(request) {
        if (request.method !== "GET") return new Response("", { status: 405 })

        const response_headers = {}

        // 🔥 Sanitize
        const { pathname: path } = new URL(encodeURI(request.url))
        const accepted_encodings = request.headers.get("accept-encoding")?.replace(/[^a-zA-Z0-9"#$%&'()*+,-./:;=?@[\]_ ]/g, "")

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
        response_headers["Content-Type"] = content_type

        // 🔀 Reroute for SPA
        if (process.env.SPA === "true" && content_type === "text/html") file_path = "/index.html"

         // 📦 Serve compressed file if possible
        let encoding = ""
        if ([".html", ".js", ".css"].includes(ext_name)) {
            if (accepted_encodings?.includes("br") && files.has(file_path + ".br")) {
                encoding = ".br"
                response_headers["Content-Encoding"] = "br"
            }
            else if (accepted_encodings?.includes("gzip") && files.has(file_path + ".gz")) {
                encoding = ".gz"
                response_headers["Content-Encoding"] = "gzip"
            }
        }
        
        // 🍱 Set cache policy
        if (content_type !== "text/html" &&
            content_type !== "application/manifest+json" &&
            content_type !== "text/markdown" &&
            !file_path.endsWith("sw.js")
        )
            response_headers["Cache-Control"] = "public, max-age=31536000, immutable"
            
        // 🚀 Serve file from cache
        if (files.has(file_path + encoding)) 
            return new Response(Bun.file("./dist" + file_path + encoding), { status: 200, headers: response_headers })
        else
            return new Response("", { status: 404 })
        
    }
}