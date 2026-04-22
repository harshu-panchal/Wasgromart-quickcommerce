const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }));
    const Seller = mongoose.model('Seller', new mongoose.Schema({}, { strict: false }));
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));

    const toysCategory = await Category.findOne({ $or: [{ slug: 'toys' }, { name: /toys/i }] });
    console.log('Toys Category:', toysCategory ? { _id: toysCategory._id, name: toysCategory.name, slug: toysCategory.slug, status: toysCategory.status } : 'NOT FOUND');

    const palakShop = await Seller.findOne({ storeName: /palak shop/i });
    console.log('Palak Shop:', palakShop ? { 
      _id: palakShop._id, 
      storeName: palakShop.storeName, 
      status: palakShop.status, 
      location: palakShop.location,
      latitude: palakShop.latitude,
      longitude: palakShop.longitude,
      serviceRadiusKm: palakShop.serviceRadiusKm
    } : 'NOT FOUND');

    if (palakShop && toysCategory) {
      const products = await Product.find({ seller: palakShop._id });
      console.log(`Palak Shop Products Count: ${products.length}`);
      products.forEach(p => {
        console.log(`- Product: ${p.productName}, Category: ${p.category}, Status: ${p.status}, Publish: ${p.publish}`);
      });
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkData();
