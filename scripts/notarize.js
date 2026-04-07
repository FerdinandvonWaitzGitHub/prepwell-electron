const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir, arch } = context;

  if (electronPlatformName !== "darwin") {
    return;
  }

  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.log("Skipping notarization — Apple credentials not set");
    return;
  }

  console.log(`afterSign hook called — arch: ${arch}, appOutDir: ${appOutDir}`);

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  if (!fs.existsSync(appPath)) {
    console.log(`App not found at ${appPath}, skipping notarization`);
    return;
  }

  const appleId = process.env.APPLE_ID;
  const password = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;
  const credentials = `--apple-id "${appleId}" --team-id "${teamId}" --password "${password}"`;

  // Step 1: Zip the app (notarytool needs zip/dmg/pkg)
  const zipPath = path.join(appOutDir, `${appName}.zip`);
  console.log(`Creating zip: ${zipPath}`);
  execSync(`ditto -c -k --keepParent "${appPath}" "${zipPath}"`, { stdio: "inherit" });

  const fileSize = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
  console.log(`Zip created: ${fileSize} MB`);

  // Step 2: Submit to Apple — fire and forget, don't wait
  console.log("Submitting to Apple notarization service...");
  try {
    const submitOutput = execSync(
      `xcrun notarytool submit "${zipPath}" ${credentials} --output-format json`,
      { encoding: "utf-8", timeout: 5 * 60 * 1000 }
    );
    console.log("Submit response:", submitOutput);

    const submitData = JSON.parse(submitOutput);
    const submissionId = submitData.id;

    if (submissionId) {
      console.log(`✅ Submitted to Apple. Submission ID: ${submissionId}`);
      console.log(`   Apple will process in the background.`);
      console.log(`   Check status later: xcrun notarytool info ${submissionId} ${credentials}`);
      console.log(`   Once accepted, staple with: xcrun stapler staple "${appPath}"`);
    }
  } catch (err) {
    // Don't fail the build if submit fails — app is still signed and usable
    console.error("Notarization submit failed (non-blocking):", err.message);
    if (err.stdout) console.log("stdout:", err.stdout);
    if (err.stderr) console.log("stderr:", err.stderr);
  } finally {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  }

  console.log("Build continues — notarization runs async at Apple.");
};
