import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FlowOps",
    short_name: "FlowOps",
    description: "Warehouse flow management",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#18181b",
    icons: [
      { src: "/icon.svg.png", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
