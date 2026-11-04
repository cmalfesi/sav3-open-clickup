export const brandingPath = "/api/workspace/branding";
export const maxLogoBytes = 1024 * 1024;
export const logoTypes = ["image/png", "image/jpeg", "image/webp"];
export const maxWorkspaceName = 80;

export function workspaceLogoVersion(url: string | null) {
  const prefix = brandingPath + "/logo/";
  if (!url?.startsWith(prefix)) return null;
  const version = url.slice(prefix.length);
  return /^[a-f0-9-]{36}$/.test(version) ? version : null;
}
