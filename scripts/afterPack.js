// Flip Electron Fuses after packaging to harden the production binary.
// Disables dangerous features like ELECTRON_RUN_AS_NODE and --inspect.
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const path = require('path');

module.exports = async function afterPack(context) {
  const ext = {
    darwin: '.app',
    linux: '',
    win32: '.exe',
  };

  const electronBinaryPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}${ext[context.electronPlatformName] || ''}`,
  );

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  });
};
