import type { MetadataRoute } from "next";

export default function robots():MetadataRoute.Robots{
  const siteUrl=process.env.NEXT_PUBLIC_SITE_URL;
  let sitemapUrl:string|undefined;
  if(siteUrl){try{sitemapUrl=new URL("/sitemap.xml",siteUrl).toString();}catch{sitemapUrl=undefined;}}
  return {
    rules:[{userAgent:"*",allow:"/",disallow:["/apps-cms/","/auth/","/api/"]}],
    ...(sitemapUrl?{sitemap:sitemapUrl}:{}),
  };
}
