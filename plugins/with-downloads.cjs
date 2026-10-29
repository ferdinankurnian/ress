const { withMainApplication, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');
module.exports = (config) => {
  config = withMainApplication(config, (mod) => {
    if (!mod.modResults.contents.includes('add(RessDownloadsPackage())')) {
      mod.modResults.contents = mod.modResults.contents.replace(
        'PackageList(this).packages.apply {',
        'PackageList(this).packages.apply {\n          add(RessDownloadsPackage())',
      );
    }
    return mod;
  });
  return withDangerousMod(config, ['android', async (mod) => {
    const target = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/java/dev/iydheko/ress');
    await fs.mkdir(target, { recursive: true });
    await fs.copyFile(path.join(__dirname, 'downloads/RessDownloadsPackage.kt'), path.join(target, 'RessDownloadsPackage.kt'));
    return mod;
  }]);
};
