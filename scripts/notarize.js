const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  // Step 1: Zip the app
  const zipPath = path.join(appOutDir, `${appName}.zip`);
  console.log(`Creating zip: ${zipPath}`);
  execSync(`ditto -c -k --keepParent "${appPath}" "${zipPath}"`, { stdio: "inherit" });

  const fileSize = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
  console.log(`Zip created: ${fileSize} MB`);

  try {
    // Step 2: Submit to Apple
    console.log("Submitting to Apple notarization service...");
    const submitOutput = execSync(
      `xcrun notarytool submit "${zipPath}" ${credentials} --output-format json`,
      { encoding: "utf-8", timeout: 5 * 60 * 1000 }
    );
    console.log("Submit response:", submitOutput);

    const submitData = JSON.parse(submitOutput);
    const submissionId = submitData.id;

    if (!submissionId) {
      throw new Error(`No submission ID returned: ${submitOutput}`);
    }

    console.log(`Submission ID: ${submissionId} — polling for result...`);

    // Step 3: Poll every 30s, max 60 min
    const maxAttempts = 120;
    let status = "In Progress";

    for (let i = 1; i <= maxAttempts; i++) {
      await sleep(30_000);

      console.log(`Poll ${i}/${maxAttempts}...`);
      const infoOutput = execSync(
        `xcrun notarytool info "${submissionId}" ${credentials} --output-format json`,
        { encoding: "utf-8", timeout: 60_000 }
      );

      const infoData = JSON.parse(infoOutput);
      status = infoData.status;
      console.log(`Status: ${status}`);

      if (status === "Accepted") {
        console.log("✅ Notarization accepted by Apple!");
        break;
      }

      if (status === "Invalid" || status === "Rejected") {
        console.error(`Notarization ${status}. Fetching Apple log...`);
        try {
          const log = execSync(
            `xcrun notarytool log "${submissionId}" ${credentials}`,
            { encoding: "utf-8", timeout: 60_000 }
          );
          console.error("Apple notarization log:", log);
        } catch (e) {
          console.error("Could not fetch log:", e.message);
        }
        throw new Error(`Notarization ${status}. See log above.`);
      }
    }

    if (status !== "Accepted") {
      throw new Error(`Notarization timed out after ${maxAttempts * 30}s. Last status: ${status}`);
    }

    // Step 4: Staple the ticket
    console.log("Stapling notarization ticket...");
    execSync(`xcrun stapler staple "${appPath}"`, { stdio: "inherit" });
    console.log("✅ Notarization complete and stapled!");

  } finally {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  }
};
