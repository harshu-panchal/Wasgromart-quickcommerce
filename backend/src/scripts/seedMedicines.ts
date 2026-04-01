
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db';
import HeaderCategory from '../models/HeaderCategory';
import Category from '../models/Category';

// Load env vars
dotenv.config();

const seedMedicines = async () => {
    try {
        await connectDB();
        console.log('Connected to DB for seeding...');

        // 1. Check/Create Header Category
        let headerCat = await HeaderCategory.findOne({
            $or: [{ slug: 'medicines' }, { slug: 'medicine' }]
        });

        if (!headerCat) {
            console.log('Creating "Medicines" Header Category...');
            headerCat = await HeaderCategory.create({
                name: 'Medicines',
                slug: 'medicines',
                iconLibrary: 'IonIcons',
                iconName: 'medkit',
                status: 'Published',
                order: 10 // Arbitrary order
            });
            console.log('Created Header Category:', headerCat.name);
        } else {
            console.log('Header Category "Medicines" already exists:', headerCat.name);
        }

        // 2. Create Sub-Categories
        const categoriesToCreate = [
            { name: 'General Medicines', slug: 'general-medicines' },
            { name: 'First Aid', slug: 'first-aid' },
            { name: 'Supplements', slug: 'supplements' },
            { name: 'Personal Care', slug: 'personal-care-pharma' }
        ];

        for (const catData of categoriesToCreate) {
            // Check by slug OR name to avoid duplicates
            let category = await Category.findOne({
                $or: [{ slug: catData.slug }, { name: catData.name }]
            });

            if (!category) {
                try {
                    category = await Category.create({
                        name: catData.name,
                        slug: catData.slug,
                        headerCategoryId: headerCat._id,
                        status: 'Active',
                        image: '', // Placeholder
                        order: 0
                    });
                    console.log(`Created Category: ${category.name}`);
                } catch (e) {
                    console.log(`Failed to create category ${catData.name}:`, e.message);
                }
            } else {
                // Ensure it's linked to the correct header category
                const currentHeaderId = category.headerCategoryId?.toString();
                const targetHeaderId = headerCat._id.toString();

                if (currentHeaderId !== targetHeaderId) {
                    category.headerCategoryId = headerCat._id as mongoose.Types.ObjectId;
                    await category.save();
                    console.log(`Updated Category: ${category.name} linked to Medicines`);
                } else {
                    console.log(`Category "${category.name}" already exists and is linked.`);
                }
            }
        }

        console.log('Seeding complete!');
        process.exit(0);

    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedMedicines();
