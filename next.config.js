const silenceDeprecations = [
  "import",
  "mixed-decls",
  "color-functions",
  "global-builtin",
  // Suppress legacy JS API deprecation warning
  "legacy-js-api",
];

const backendApiBaseUrl = (
  process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim() ||
  "http://localhost:3001/api/v1"
).replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  i18n: {
    locales: ["fa", "en"],
    defaultLocale: "fa",
    localeDetection: false,
  },
  // Keep browser API requests same-origin and let Next.js forward them to NestJS.
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: backendApiBaseUrl + "/:path*",
      },
    ];
  },
  webpack: config => {
    // Handle asset files like fonts and images
    config.module.rules.push({
      test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
      type: "asset",
    });

    // Patch sass-loader to silence deprecation warnings
    config.module.rules.forEach(rule => {
      if (Array.isArray(rule.oneOf)) {
        rule.oneOf.forEach(one => {
          if (
            one.use &&
            one.use.find &&
            one.use.find(u => u.loader && u.loader.includes("sass-loader"))
          ) {
            one.use.forEach(u => {
              if (u.loader && u.loader.includes("sass-loader")) {
                u.options = {
                  ...u.options,
                  sassOptions: {
                    ...u.options?.sassOptions,
                    silenceDeprecations,
                  },
                };
              }
            });
          }
        });
      }
    });

    return config;
  },
};

module.exports = nextConfig;
