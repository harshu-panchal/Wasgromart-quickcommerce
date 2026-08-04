import axios from "axios";

async function main() {
  try {
    const res = await axios.get("http://localhost:5000/api/v1/config/public");
    console.log("=== PUBLIC CONFIG API RESPONSE ===");
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error("HTTP error:", err.message);
    if (err.response) {
      console.error("Response data:", err.response.data);
    }
  }
}

main();
