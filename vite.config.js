import { defineConfig } from "vite";
import { resolve } from "path";
import fs from "fs";

function copyExtensionFiles() {
  return {
    name: "copy-extension-files",
    closeBundle() {
      fs.mkdirSync("dist", { recursive: true });

      if (fs.existsSync("public/manifest.json")) {
        fs.copyFileSync("public/manifest.json", "dist/manifest.json");
      }

      if (fs.existsSync("public/popup.html")) {
        let popupHtml = fs.readFileSync("public/popup.html", "utf-8");
        popupHtml = popupHtml.replace(
          '/src/popup/index.js',
          './popup.js'
        );
        fs.writeFileSync("dist/popup.html", popupHtml);
      }

      if (fs.existsSync("styles/content.css")) {
        fs.copyFileSync("styles/content.css", "dist/content.css");
      }
    }
  };
}

export default defineConfig({
  plugins: [copyExtensionFiles()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, "src/content/index.js"),
        popup: resolve(__dirname, "src/popup/index.js")
      },
      output: {
        entryFileNames: "[name].js"
      }
    }
  }
});