const { withAndroidManifest, withMainApplication, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

module.exports = (config) => {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest.queries ??= [];
    const query = { intent: [{
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      category: [{ $: { 'android:name': 'android.intent.category.BROWSABLE' } }],
      data: [{ $: { 'android:scheme': 'https' } }],
    }] };
    if (!manifest.queries.some((existing) => JSON.stringify(existing).includes('android.intent.category.BROWSABLE')))
      manifest.queries.push(query);
    return mod;
  });
  config = withMainApplication(config, (mod) => {
    if (!mod.modResults.contents.includes('add(RessBrowserPackage())')) {
      mod.modResults.contents = mod.modResults.contents.replace(
        'PackageList(this).packages.apply {',
        'PackageList(this).packages.apply {\n          add(RessBrowserPackage())',
      );
    }
    return mod;
  });
  return withDangerousMod(config, ['android', async (mod) => {
    const target = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/java/dev/iydheko/ress');
    await fs.mkdir(target, { recursive: true });
    await fs.copyFile(path.join(__dirname, 'browser/RessBrowserPackage.kt'), path.join(target, 'RessBrowserPackage.kt'));
    return mod;
  }]);
};
