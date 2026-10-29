import type { MetadataRoute } from "next";
import { cmsApi } from "@/helpers/cmsApi";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl=process.env.NEXT_PUBLIC_SITE_URL;
  if(!siteUrl)return [];
  let base:URL;
  try{base=new URL(siteUrl);}catch{return [];}
  try{
    const records=await cmsApi.publicSitemap();
    return records.map(record=>({
      url:new URL(record.href,base).toString(),
      lastModified:record.lastModified,
      alternates:{languages:Object.fromEntries(record.alternates.filter(item=>item.slug).map(item=>[item.localeCode,new URL(item.href,base).toString()]))},
    }));
  }catch{
    return [];
  }
}
