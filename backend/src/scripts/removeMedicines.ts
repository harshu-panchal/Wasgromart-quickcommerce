
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db';
import HeaderCategory from '../models/HeaderCategory';
import Category from '../models/Category';
import Product from '../models/Product';

// Load env vars
dotenv.config();

const removeMedicines = async () => {
    try {
        await connectDB();
        console.log('Connected to DB for cleanup...');

        // 1. Find Medicines Header Category
        const headerCat = await HeaderCategory.findOne({
            $or: [{ slug: 'medicines' }, { slug: 'medicine' }]
        });

        if (headerCat) {
            console.log(`Found Header Category: ${headerCat.name} (${headerCat._id})`);

            // 2. Delete linked Products
            const deleteProducts = await Product.deleteMany({ headerCategoryId: headerCat._id });
            console.log(`Deleted ${deleteProducts.deletedCount} products.`);

            // 3. Delete linked Subcategories
            const deleteSubcats = await Category.deleteMany({ headerCategoryId: headerCat._id });
            console.log(`Deleted ${deleteSubcats.deletedCount} subcategories.`);

            // 4. Delete Header Category
            await HeaderCategory.findByIdAndDelete(headerCat._id);
            console.log('Deleted Medicines Header Category.');
        } else {
            console.log('Medicines Header Category not found.');
        }

        console.log('Cleanup complete!');
        process.exit(0);

    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
};

removeMedicines();
