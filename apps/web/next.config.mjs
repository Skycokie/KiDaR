/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@imgly/background-removal", "onnxruntime-web"],
};

export default nextConfig;
