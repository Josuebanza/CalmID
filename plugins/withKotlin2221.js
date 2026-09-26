const {
  withProjectBuildGradle,
  withAppBuildGradle,
} = require('@expo/config-plugins');

module.exports = function withAndroid361(config) {
  // Force Kotlin 2.2.21
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      return config;
    }

    const regex =
      /classpath\(\s*['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin(?::[^'"]+)?['"]\s*\)/;

    const replacement =
      "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.21')";

    if (regex.test(config.modResults.contents)) {
      config.modResults.contents =
        config.modResults.contents.replace(regex, replacement);
    }

    return config;
  });

  // Expo only exposes compileSdkVersion as an integer.
  // SmartSpectra requires Android 36.1, so add minor API level 1.
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      return config;
    }

    const original =
      'compileSdk rootProject.ext.compileSdkVersion';

    const replacement =
      `compileSdk 36
    compileSdkMinor 1`;

    if (!config.modResults.contents.includes(replacement)) {
      config.modResults.contents =
        config.modResults.contents.replace(original, replacement);
    }

    return config;
  });

  return config;
};