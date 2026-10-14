import type { MetadataRoute } from "next";

/**
 * Public marketing and legal pages may be indexed. Everything that belongs to an account,
 * every API route and every published AR experience stays out of search engines.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms", "/cookies"],
        disallow: [
          "/ar/",
          "/api/",
          "/studio",
          "/creaza",
          "/dashboard",
          "/internal",
          "/login",
          "/intra",
          "/auth/"
        ]
      }
    ]
  };
}
