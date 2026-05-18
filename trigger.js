// trigger.js
// Run this script using: node trigger.js

try { process.loadEnvFile(); } catch (e) {} // Automatically loads variables from .env in Node 21+

const USERNAME = "Sallytion";
const REPO_NAME = "reeldown";
const PAT_TOKEN = process.env.GITHUB_PAT; 

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function triggerWorkflow() {
  if (PAT_TOKEN === "YOUR_GITHUB_PAT_TOKEN") {
    console.error("Error: Please put your actual GitHub PAT Token in the script or set the GITHUB_PAT environment variable.");
    return;
  }

  const dispatchUrl = `https://api.github.com/repos/${USERNAME}/${REPO_NAME}/dispatches`;

  try {
    console.log("🚀 Triggering GitHub Action...");
    const response = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${PAT_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "NodeJS-Trigger-Script" 
      },
      body: JSON.stringify({
        event_type: "scrape_reel"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to trigger workflow. Status: ${response.status}`);
      console.error("Response:", errorText);
      return;
    }

    console.log("✅ Triggered! Waiting for the workflow to spin up...");
    
    // Wait for GitHub to register the run
    await delay(5000);

    const runsUrl = `https://api.github.com/repos/${USERNAME}/${REPO_NAME}/actions/runs?event=repository_dispatch`;
    let runsReq = await fetch(runsUrl, { headers: { "Authorization": `Bearer ${PAT_TOKEN}`, "User-Agent": "NodeJS-Trigger" } });
    let runsData = await runsReq.json();
    
    if (!runsData.workflow_runs || runsData.workflow_runs.length === 0) {
      console.error("❌ Could not find the workflow run.");
      return;
    }

    // Get the most recent run
    const runId = runsData.workflow_runs[0].id;
    console.log(`⏳ Found workflow run #${runId}. Waiting for it to complete (this takes a minute)...`);

    // Poll until the action completes
    let status = "in_progress";
    while (status !== "completed") {
      await delay(5000);
      const runReq = await fetch(`https://api.github.com/repos/${USERNAME}/${REPO_NAME}/actions/runs/${runId}`, {
        headers: { "Authorization": `Bearer ${PAT_TOKEN}`, "User-Agent": "NodeJS-Trigger" }
      });
      const runInfo = await runReq.json();
      status = runInfo.status;
      process.stdout.write(".");
    }

    console.log("\n✅ Workflow completed! Fetching artifact URL...");

    // Get artifact download URL
    const artifactsUrl = `https://api.github.com/repos/${USERNAME}/${REPO_NAME}/actions/runs/${runId}/artifacts`;
    const artifactsReq = await fetch(artifactsUrl, { headers: { "Authorization": `Bearer ${PAT_TOKEN}`, "User-Agent": "NodeJS-Trigger" } });
    const artifactsData = await artifactsReq.json();

    if (artifactsData.artifacts && artifactsData.artifacts.length > 0) {
      const artifact = artifactsData.artifacts[0];
      const downloadUrl = artifact.archive_download_url;
      console.log(`\n📦 Artifact found! Download URL:`);
      console.log(downloadUrl);
      console.log(`\n(Note: Pass your PAT token in the Authorization header to download the zip file from this URL)`);
    } else {
      console.log("❌ No artifacts found for this run.");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

triggerWorkflow();