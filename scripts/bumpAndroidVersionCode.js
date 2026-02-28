const fs = require('fs');
const path = require('path');

const gradleFilePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');

function bumpVersionCode(fileContent) {
  const versionCodeRegex = /(versionCode\s*=\s*)(\d+)/;
  const match = fileContent.match(versionCodeRegex);

  if (!match) {
    throw new Error('Could not find versionCode in android/app/build.gradle');
  }

  const currentCode = Number(match[2]);
  if (!Number.isInteger(currentCode)) {
    throw new Error(`Invalid versionCode value: ${match[2]}`);
  }

  const nextCode = currentCode + 1;
  const updatedContent = fileContent.replace(versionCodeRegex, `$1${nextCode}`);

  return { updatedContent, currentCode, nextCode };
}

function main() {
  const fileContent = fs.readFileSync(gradleFilePath, 'utf8');
  const { updatedContent, currentCode, nextCode } = bumpVersionCode(fileContent);

  fs.writeFileSync(gradleFilePath, updatedContent, 'utf8');
  console.log(`Android versionCode bumped: ${currentCode} -> ${nextCode}`);
}

main();
