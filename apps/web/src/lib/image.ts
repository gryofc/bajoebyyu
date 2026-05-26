/**
 * Utility library for dynamic image optimization via CDNs.
 */

/**
 * Optimizes Google Usercontent URLs (e.g., from Blogger, Photos, or AIDA)
 * by appending dynamic width and WebP formatting parameters.
 *
 * @param url Original googleusercontent.com image URL
 * @param width Target display width in pixels
 * @returns Optimized URL requesting WebP format
 */
export function optimizeGoogleImage(url: string, width = 800): string {
  if (!url) return "";

  if (url.includes("googleusercontent.com")) {
    // Strip any existing parameters starting with = or ?
    const baseUrl = url.split("=")[0].split("?")[0];
    // =w{width}-rw instructs the CDN to scale to that width and serve WebP format
    return `${baseUrl}=w${width}-rw`;
  }

  return url;
}

/**
 * Optimizes Shopee CDN product images by appending size suffixes (e.g. _640x640)
 * to request auto-scaled and compressed versions.
 *
 * @param url Original Shopee CDN image URL
 * @param size Suffix size (e.g., '640x640', '320x320', or 'tn')
 * @returns Resized and optimized image URL
 */
export function optimizeProductImage(url: string, size = "tn"): string {
  if (!url) return "";

  if (url.includes("susercontent.com/file/")) {
    // If it already has an existing size suffix or thumbnail flag, do not modify it
    if (!url.match(/_(tn|\d+x\d+)$/)) {
      return `${url}_${size}`;
    }
  }

  return url;
}
