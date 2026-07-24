const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://wasgromart_db_user:Wasgromart123@cluster0.uwy4fvy.mongodb.net/SpeeUp?retryWrites=true&w=majority&appName=Cluster0';
  console.log("Connecting to:", uri.replace(/:([^:@]+)@/, ':****@'));
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  console.log("Collections:", collectionNames);

  let results = {
    collections: collectionNames,
    searches: {}
  };

  // Find document with Urmilaben or SEJC7RDHX5 across all collections
  for (const name of collectionNames) {
    const col = db.collection(name);
    
    const docs = await col.find({
      $or: [
        { name: /Urmila/i },
        { username: /Urmila/i },
        { ownerName: /Urmila/i },
        { referralCode: "SEJC7RDHX5" },
        { refCode: "SEJC7RDHX5" },
        { code: "SEJC7RDHX5" },
        { id: "SEJC7RDHX5" },
        { memberId: "SEJC7RDHX5" },
        { userCode: "SEJC7RDHX5" },
        { sponsorId: "SEJC7RDHX5" },
        { userId: "SEJC7RDHX5" }
      ]
    }).toArray();

    if (docs && docs.length > 0) {
      console.log(`Found ${docs.length} matching docs in collection: ${name}`);
      results.searches[name] = docs;
    }
  }

  // Find related transactions if a user was found
  let foundId = null;
  let foundRefCode = "SEJC7RDHX5";
  for (const colName in results.searches) {
    const docs = results.searches[colName];
    for (const doc of docs) {
      if (doc._id) foundId = doc._id;
      if (doc.userId && !foundId) foundId = doc.userId;
      if (doc.refCode) foundRefCode = doc.refCode;
      if (doc.referralCode) foundRefCode = doc.referralCode;
    }
  }

  if (foundId) {
    console.log("Found ID:", foundId, "- searching for transactions/wallet entries");
    results.foundId = foundId;
    for (const name of collectionNames) {
      if (
        name.toLowerCase().includes('transaction') || 
        name.toLowerCase().includes('wallet') || 
        name.toLowerCase().includes('history') || 
        name.toLowerCase().includes('income') || 
        name.toLowerCase().includes('earning')
      ) {
        const col = db.collection(name);
        const txs = await col.find({
          $or: [
            { userId: foundId },
            { memberId: foundId },
            { toUser: foundId },
            { user: foundId },
            { customerId: foundId },
            { customer: foundId },
            { refCode: foundRefCode },
            { referralCode: foundRefCode }
          ]
        }).toArray();
        if (txs && txs.length > 0) {
          results.searches[`related_${name}`] = txs;
        }
      }
    }
  }

  const outputPath = path.join(__dirname, '..', 'db_search_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log("Results successfully written to:", outputPath);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
