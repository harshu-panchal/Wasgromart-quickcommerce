const https = require("https");

const API_KEY = "737441146281892";
const API_SECRET = "N6n7NdoFLDcEDnXPZCw8AoEC04c";
const CLOUD_NAME = "dv1l9sb4p";

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
  console.log("=== CHECKING PRODUCTS IN CLOUDINARY ACCOUNT:", CLOUD_NAME, "===");

  // 1. Direct query for ziy9g4ugbz4ruu1cb4wk
  const res1 = await apiGet("/resources/image/upload?prefix=products/ziy9g4ugbz4ruu1cb4wk");
  console.log("Prefix products/ziy9g4ugbz4ruu1cb4wk:", res1.resources ? res1.resources.map(r => r.secure_url) : res1);

  // 2. List products folder
  const res2 = await apiGet("/resources/image/upload?prefix=products/&max_results=10");
  console.log("Products folder sample:", res2.resources ? res2.resources.map(r => r.public_id) : res2);

  // 3. List speeup/products folder
  const res3 = await apiGet("/resources/image/upload?prefix=speeup/products/&max_results=10");
  console.log("speeup/products sample:", res3.resources ? res3.resources.map(r => r.public_id) : res3);
}

main();
