/**
 * Get the URL for the shared worker file
 * This function handles both bundled and unbundled scenarios
 */
export function getSharedWorkerUrl(): string {
  // Allow consumers to override the worker URL via global config
  if (typeof window !== 'undefined' && (window as any).__EKA_SDK_WORKER_URL__) {
    return (window as any).__EKA_SDK_WORKER_URL__;
  }

  // Try to use document.currentScript for browser environments (CommonJS/UMD)
  if (typeof document !== 'undefined' && document.currentScript) {
    try {
      const script = document.currentScript as HTMLScriptElement;
      if (script.src) {
        const baseUrl = script.src.substring(0, script.src.lastIndexOf('/'));
        // Construct path to shared worker relative to current script
        const workerPath = baseUrl + '/shared-worker/s3-file-upload.js';
        return workerPath;
      }
    } catch (e) {
      // Fall through to other methods
    }
  }

  // For bundled packages, use a path relative to the package root
  // When installed via npm, this resolves to node_modules/@eka-care/ekascribe-ts-sdk/dist/shared-worker/s3-file-upload.js
  // For CDN usage, consumers should set __EKA_SDK_WORKER_URL__
  return '@eka-care/ekascribe-ts-sdk/dist/shared-worker/s3-file-upload.js';
}
