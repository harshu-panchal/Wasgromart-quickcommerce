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
  const res1 = await apiGet("/resources/image/upload?prefix=products/bgccg0cmoelxacogtxjk");
  console.log("dv1l9sb4p check products/bgccg0cmoelxacogtxjk:", res1);
  
  const res2 = await apiGet("/resources/image/upload?prefix=bgccg0cmoelxacogtxjk");
  console.log("dv1l9sb4p check bgccg0cmoelxacogtxjk:", res2);
}

main();
