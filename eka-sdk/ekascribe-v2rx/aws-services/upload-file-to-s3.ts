/**
 * Unified S3 upload interface that selects the appropriate implementation
 * based on the build target (ES6 or ES11).
 * 
 * This file acts as a wrapper that conditionally exports the correct
 * upload function based on build-time configuration.
 * 
 * Build configurations:
 * - ES6 build: Sets BUILD_TARGET_ES6 = true, uses upload-file-to-s3-es6.ts
 * - ES11 build: BUILD_TARGET_ES6 = false, uses upload-file-to-s3-es11.ts
 * 
 * The bundler will tree-shake the unused import based on the build-time constant.
 */

// Use build-time define to determine which implementation to use
// BUILD_TARGET_ES6 is injected at build time by the bundler (esbuild/vite)
// @ts-ignore - BUILD_TARGET_ES6 is a build-time constant
const USE_ES6 = typeof BUILD_TARGET_ES6 !== 'undefined' && BUILD_TARGET_ES6 === true;

// Import both implementations - the bundler will tree-shake the unused one
import pushFilesToS3V2 from './upload-file-to-s3-es6';
import pushFileToS3 from './upload-file-to-s3-es11';

// Export the appropriate function based on build target
// The bundler's dead code elimination will remove the unused branch
export default USE_ES6 ? pushFilesToS3V2 : pushFileToS3;

