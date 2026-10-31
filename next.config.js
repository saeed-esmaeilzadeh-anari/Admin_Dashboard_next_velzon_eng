const silenceDeprecations = [
  "import",
  "mixed-decls",
  "color-functions",
  "global-builtin",
  // Suppress legacy JS API deprecation warning
  "legacy-js-api",
];

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
