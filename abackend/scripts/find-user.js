const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  for (const col of collections) {
    const name = col.name;
    const docByName = await db.collection(name).findOne({
      $or: [
        { name: /Urmila/i },
        { username: /Urmila/i },
        { ownerName: /Urmila/i },
        { referralCode: "SEJC7RDHX5" },
        { refCode: "SEJC7RDHX5" },
        { code: "SEJC7RDHX5" },
        { id: "SEJC7RDHX5" }
      ]
    });
    if (docByName) {
      console.log(`Found in collection: ${name}`);
      console.log(JSON.stringify(docByName, null, 2));
    }
  }

  process.exit(0);
}
run().catch(console.error);
