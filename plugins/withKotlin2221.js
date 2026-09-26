const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withKotlin2221(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      return config;
    }

    const kotlinPluginRegex =
      /classpath\(\s*['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin['"]\s*\)/;

    const pinnedKotlinPlugin =
      "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.21')";

    if (config.modResults.contents.includes(pinnedKotlinPlugin)) {
      return config;
    }

    if (!kotlinPluginRegex.test(config.modResults.contents)) {
      throw new Error(
        'Could not find Kotlin Gradle plugin classpath in android/build.gradle'
      );
    }

    config.modResults.contents = config.modResults.contents.replace(
      kotlinPluginRegex,
      pinnedKotlinPlugin
    );

    return config;
  });
};