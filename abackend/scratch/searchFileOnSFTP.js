const SFTPClient = require("ssh2-sftp-client");

const SSH_CONFIG = {
  host: "147.93.99.211",
  port: 65002,
  username: "u910031778",
  password: "Wasgro@#123",
};

async function searchDir(sftp, dirPath, filename) {
  try {
    const list = await sftp.list(dirPath);
    for (const item of list) {
      const fullPath = dirPath + "/" + item.name;
      if (item.type === "d") {
        await searchDir(sftp, fullPath, filename);
      } else if (item.name.includes(filename)) {
        console.log("FOUND FILE:", fullPath, `(${item.size} bytes)`);
      }
    }
  } catch (e) {}
}

async function main() {
  const sftp = new SFTPClient();
  await sftp.connect(SSH_CONFIG);
  console.log("Connected to SFTP! Searching for xpxzvafadrcxsdt8m2du...");

  await searchDir(sftp, "/home/u910031778/domains/api.wasgromart.com/uploads", "xpxzvafadrcxsdt8m2du");

  await sftp.end();
}

main().catch(console.error);
