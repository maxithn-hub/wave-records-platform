/**
 * Resolves static brand asset paths respecting GitHub Pages sub-path deployments.
 */
export function getBrandAssetUrl(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${cleanPath}`;
}
