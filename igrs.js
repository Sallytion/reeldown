const { chromium } = require("playwright");
const axios = require("axios");
const fs = require("fs");

const USERNAME = "girdharlogistics";

async function downloadFile(url, filename) {
  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
  });

  const writer = fs.createWriteStream(filename);

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  console.log("Opening profile...");

  await page.goto(`https://www.instagram.com/${USERNAME}/`, {
    waitUntil: "networkidle",
  });

  // Wait for reels links
  await page.waitForSelector('a[href*="/reel/"]');

  // Grab latest reel URL
  const latestReel = await page.$eval(
    'a[href*="/reel/"]',
    (el) => el.href
  );

  console.log("Latest reel:", latestReel);

  let videoUrl = null;
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('graphql') && !videoUrl) {
      try {
        const text = await response.text();
        if (text.includes('video_url')) {
          const match = text.match(/"video_url":"([^"]+)"/);
          if (match) {
            videoUrl = match[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
          }
        }
      } catch (e) {
        // Ignore read errors
      }
    }
  });

  // Open reel
  await page.goto(latestReel, {
    waitUntil: "networkidle",
  });
  
  // Wait a bit to ensure video loads and network requests fire
  await page.waitForTimeout(3000);

  // Extract useful stuff
  const ogTitle = await page.evaluate(() => document.querySelector('meta[property="og:title"]')?.content || "");
  const caption = ogTitle;

  const thumbnail = await page.evaluate(() => document.querySelector('meta[property="og:image"]')?.content || "");

  const hashtags = caption
    ? [...caption.matchAll(/#\w+/g)].map((x) => x[0])
    : [];

  const output = {
    reel_url: latestReel,
    caption,
    hashtags,
    video_url: videoUrl,
    thumbnail,
    likes: "hidden",
    comments: "hidden",
  };

  console.log("\n=== REEL DATA ===");
  console.log(JSON.stringify(output, null, 2));

  // Save metadata
  fs.writeFileSync(
    "reel_data.json",
    JSON.stringify(output, null, 2)
  );

  // Download video
  if (videoUrl) {
    console.log("\nDownloading video...");

    await downloadFile(videoUrl, "latest_reel.mp4");

    console.log("Video saved as latest_reel.mp4");
  }

  await browser.close();
})();