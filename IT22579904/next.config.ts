import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    // Use absolute project path so Turbopack doesn't infer the wrong workspace
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
