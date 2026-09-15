/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@imgly/background-removal", "onnxruntime-web"],
  webpack(config) {
    config.module.rules.push({
      test: /\.m?js$/,
      type: "javascript/auto"
    });
    return config;
  }
};

export default nextConfig;
