const mongoose = require('mongoose');
const uri = "mongodb+srv://kosilecommerce_db_user:973Chc5YHtBa3F1i@kosil.fcettwg.mongodb.net/SpeeUp";

async function checkData() {
    try {
        await mongoose.connect(uri);
        const HomeSection = mongoose.model('HomeSection', new mongoose.Schema({}, { strict: false }));
        const sections = await HomeSection.find({ isActive: true }).lean();

        console.log("Home Sections:", JSON.stringify(sections.map(s => ({
            title: s.title,
            displayType: s.displayType,
            categories: s.categories,
            subCategories: s.subCategories
        })), null, 2));

        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
}

checkData();
