const SFTPClient = require("ssh2-sftp-client");

const SSH_CONFIG = {
  host: "147.93.99.211",
  port: 65002,
  username: "u910031778",
  password: "Wasgro@#123",
};

async function main() {
  const sftp = new SFTPClient();
  await sftp.connect(SSH_CONFIG);
  console.log("Connected via SFTP!");

  const testFiles = [
    "/home/u910031778/domains/api.wasgromart.com/uploads/products/bgccg0cmoelxacogtxjk.png",
    "/home/u910031778/domains/api.wasgromart.com/uploads/products/gallery/xn1f0j7oiyvfpt7k3vxx.png",
    "/home/u910031778/domains/api.wasgromart.com/uploads/products/gallery/xpxzvafadrcxsdt8m2du.jpg"
  ];

  for (const f of testFiles) {
    try {
      const stat = await sftp.stat(f);
      console.log("EXISTS:", f, `(${stat.size} bytes)`);
    } catch (e) {
      console.error("NOT FOUND:", f);
    }
  }

  await sftp.end();
}

main().catch(console.error);
