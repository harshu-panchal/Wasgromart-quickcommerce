const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/washgrow');
  console.log("Connected");
  
  const sellers = await mongoose.connection.collection('sellers').find({}, { projection: { sellerName: 1, commission: 1, commissionRate: 1, balance: 1, _id: 0 } }).limit(5).toArray();
  console.log(JSON.stringify(sellers, null, 2));
  
  process.exit(0);
}
run().catch(console.error);
