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

  // Step 1: Create a zip for notarization (notarytool requires zip/dmg/pkg)
  const zipPath = path.join(appOutDir, `${appName}.zip`);
  console.log(`Creating zip for notarization: ${zipPath}`);
  execSync(`ditto -c -k --keepParent "${appPath}" "${zipPath}"`, { stdio: "inherit" });

  const fileSize = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
  console.log(`Zip created: ${fileSize} MB`);

  // Step 2: Submit to Apple via notarytool directly (full control + live output)
  console.log("Submitting to Apple notarization service...");
  try {
    const submitResult = execSync(
      `xcrun notarytool submit "${zipPath}" ` +
      `--apple-id "${process.env.APPLE_ID}" ` +
      `--team-id "${process.env.APPLE_TEAM_ID}" ` +
      `--password "${process.env.APPLE_APP_SPECIFIC_PASSWORD}" ` +
      `--wait --timeout 15m`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 20 * 60 * 1000 }
    );
    console.log("notarytool output:", submitResult);

    if (!submitResult.includes("Accepted")) {
      // Get the submission ID and fetch the log
      const idMatch = submitResult.match(/id:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        console.log("Fetching notarization log...");
        const log = execSync(
          `xcrun notarytool log "${idMatch[1]}" ` +
          `--apple-id "${process.env.APPLE_ID}" ` +
          `--team-id "${process.env.APPLE_TEAM_ID}" ` +
          `--password "${process.env.APPLE_APP_SPECIFIC_PASSWORD}"`,
          { encoding: "utf-8" }
        );
        console.log("Notarization log:", log);
      }
      throw new Error("Notarization was not accepted. See log above.");
    }
  } catch (err) {
    // If it errored, try to get the log anyway
    console.error("Notarization failed:", err.message);
    if (err.stdout) console.log("stdout:", err.stdout);
    if (err.stderr) console.log("stderr:", err.stderr);
    throw err;
  } finally {
    // Clean up zip
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  }

  // Step 3: Staple the ticket to the app
  console.log("Stapling notarization ticket...");
  execSync(`xcrun stapler staple "${appPath}"`, { stdio: "inherit" });

  console.log("Notarization complete and stapled.");
};
