const { Client } = require("ssh2");

const SSH_CONFIG = {
  host: "147.93.99.211",
  port: 65002,
  username: "u910031778",
  password: "Wasgro@#123",
  readyTimeout: 30000,
  algorithms: {
    serverHostKey: [
      "ssh-rsa",
      "ssh-dss",
      "ecdsa-sha2-nistp256",
      "ecdsa-sha2-nistp384",
      "ecdsa-sha2-nistp521",
      "rsa-sha2-512",
      "rsa-sha2-256",
      "ssh-ed25519"
    ]
  }
};

const conn = new Client();

conn.on("error", (err) => {
  console.error("SSH Error:", err);
});

conn.on("ready", () => {
  console.log("SSH Connection Established!");
  
  const cmd = `
    echo "=== CURRENT DIRECTORY & PM2 ==="
    pwd
    pm2 status 2>/dev/null || node -v
    
    echo "=== DOMAINS / API DIRECTORIES ==="
    ls -la /home/u910031778/domains/api.wasgromart.com/ || echo "no api domain dir"
    
    echo "=== CHECK UPLOADS DIR ==="
    ls -la /home/u910031778/domains/api.wasgromart.com/uploads/ || echo "no uploads dir"
    ls -la /home/u910031778/domains/api.wasgromart.com/uploads/products/ | head -n 10 || echo "no products dir"
    
    echo "=== FIND ziy9g4ugbz4ruu1cb4wk.jpg ==="
    find /home/u910031778/ -name "ziy9g4ugbz4ruu1cb4wk*" 2>/dev/null
    
    echo "=== CHECK NODEJS APP DIR & .ENV ==="
    find /home/u910031778/ -name ".env" 2>/dev/null
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on("close", (code, signal) => {
      console.log("Command finished with code " + code);
      conn.end();
    }).on("data", (data) => {
      console.log("STDOUT: " + data);
    }).stderr.on("data", (data) => {
      console.log("STDERR: " + data);
    });
  });
}).connect(SSH_CONFIG);
