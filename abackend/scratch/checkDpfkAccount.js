const https = require("https");

const API_KEY = "715738272914696";
const API_SECRET = "LX7fU96dlOZoEs0iNTuswOciKmQ";
const CLOUD_NAME = "dpfkjdyy6";

function authHeader() {
  return "Basic " + Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64");
}

function apiGet(pathStr) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.cloudinary.com",
      path: `/v1_1/${CLOUD_NAME}${pathStr}`,
      method: "GET",
      headers: {
        Authorization: authHeader(),
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  console.log("=== TESTING CLOUDINARY ACCOUNT:", CLOUD_NAME, "===");

  try {
    const res1 = await apiGet("/resources/image/upload?max_results=10");
    console.log("Status: API call successful!");
    console.log("Sample resources count:", res1.resources ? res1.resources.length : 0);
    if (res1.resources) {
      console.log("Sample public_ids:", res1.resources.map(r => r.public_id));
    } else {
      console.log("Response:", res1);
    }
  } catch (e) {
    console.error("API error:", e.message);
  }
}

main();
