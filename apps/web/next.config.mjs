import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveOrtBrowserEntry() {
  // require.resolve hits the Node entry; walk up to package root then pick browser bundle.
  const nodeEntry = require.resolve("onnxruntime-web");
  let dir = path.dirname(nodeEntry);
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg.name === "onnxruntime-web") {
          return path.join(dir, "dist", "ort.bundle.min.mjs");
        }
      } catch {
        // keep walking
      }
    }
    dir = path.dirname(dir);
  }
  return path.join(__dirname, "node_modules", "onnxruntime-web", "dist", "ort.bundle.min.mjs");
}

const ortBrowserEntry = resolveOrtBrowserEntry();

/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@kidar/core", "@imgly/background-removal", "onnxruntime-web"],
  webpack(config, { isServer, webpack }) {
    // Prefer the browser bundle; package exports otherwise resolve to ort.node
    // under some Next/webpack conditions and blow up Terser / RelativeURL.
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-web$": ortBrowserEntry
    };

    config.module.parser = {
      ...config.module.parser,
      javascript: {
        ...(config.module.parser?.javascript ?? {}),
        // Keep `new URL(..., import.meta.url)` as real URLs — Next's RelativeURL
        // shim makes onnxruntime-web throw `url.replace is not a function`.
        url: false
      }
    };

    config.module.rules.unshift({
      test: /onnxruntime-web[/\\].*\.mjs$/,
      resolve: { fullySpecified: false },
      type: "javascript/auto"
    });

    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /ort\.(node|webgpu)/
      })
    );

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        module: false
      };
    }

    return config;
  }
};

export default nextConfig;
