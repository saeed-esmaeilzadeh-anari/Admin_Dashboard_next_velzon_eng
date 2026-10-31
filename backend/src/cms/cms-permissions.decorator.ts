import { SetMetadata } from "@nestjs/common";

export const CMS_PERMISSIONS_KEY = "cms_permissions";
export const CmsPermissions = (...permissions: string[]) => SetMetadata(CMS_PERMISSIONS_KEY, permissions);
