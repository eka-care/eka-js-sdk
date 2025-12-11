/**
 * Get the URL for the shared worker file
 * This function handles both bundled and unbundled scenarios
 */
export function getSharedWorkerUrl(): string {
  console.log('getSharedWorkerUrl: start');

  // Allow consumers to override the worker URL via global config
  if (typeof window !== 'undefined' && (window as any).__EKA_SDK_WORKER_URL__) {
    console.log('getSharedWorkerUrl: global override');
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
        console.log('getSharedWorkerUrl: from currentScript', workerPath);
        return workerPath;
      }
    } catch (e) {
      console.log('getSharedWorkerUrl: currentScript failed', e);
      // Fall through to other methods
    }
  }

  // Fallback: use location origin (browser) for relative asset resolution
  if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
    try {
      const workerPath = new URL(
        '/shared-worker/s3-file-upload.js',
        window.location.href
      ).toString();
      console.log('getSharedWorkerUrl: from window.location', workerPath);
      return workerPath;
    } catch (e) {
      console.log('getSharedWorkerUrl: window.location fallback failed', e);
    }
  }

  console.log('getSharedWorkerUrl: default package path');

  // For bundled packages, use a path relative to the package root
  // When installed via npm, this resolves to node_modules/@eka-care/ekascribe-ts-sdk/dist/shared-worker/s3-file-upload.js
  // For CDN usage, consumers should set __EKA_SDK_WORKER_URL__
  return '@eka-care/ekascribe-ts-sdk/dist/shared-worker/s3-file-upload.js';
}
