
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db';
import HeaderCategory from '../models/HeaderCategory';
import Category from '../models/Category';
import Product from '../models/Product';
import Seller from '../models/Seller'; // Assuming Seller model exists

// Load env vars
dotenv.config();

const seedMedicineProducts = async () => {
    try {
        await connectDB();
        console.log('Connected to DB for product seeding...');

        // 1. Get Medicines Header Category
        const headerCat = await HeaderCategory.findOne({
            $or: [{ slug: 'medicines' }, { slug: 'medicine' }]
        });

        if (!headerCat) {
            console.error('Medicines Header Category not found. Run seedMedicines.ts first.');
            process.exit(1);
        }

        // 2. Get Subcategories
        const subcats = await Category.find({ headerCategoryId: headerCat._id });
        if (subcats.length === 0) {
            console.error('No subcategories found for Medicines. Run seedMedicines.ts first.');
            process.exit(1);
        }

        // 3. Get a Seller
        let seller = await Seller.findOne({});
        if (!seller) {
            console.log('No seller found. Please create a seller account first via the UI or seed script.');
            // Ideally we shouldn't create a seller here without proper auth structure, 
            // but for now we'll just fail if no seller exists to avoid data inconsistency.
            process.exit(1);
        }
        console.log(`Using Seller: ${seller._id}`);

        // 4. Create Dummy Products
        const products = [
            {
                name: 'Paracetamol 650mg',
                slug: 'paracetamol-650mg',
                category: 'general-medicines',
                price: 30,
                description: 'Effective for fever and mild pain relief.',
                pack: '1 Strip (10 Tablets)',
                image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200'
            },
            {
                name: 'Vitamin C Tablets',
                slug: 'vitamin-c-tablets',
                category: 'supplements',
                price: 250,
                description: 'Boosts immunity and skin health.',
                pack: 'Bottle (60 Tablets)',
                image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200'
            },
            {
                name: 'Band-Aid Pack',
                slug: 'band-aid-pack',
                category: 'first-aid',
                price: 150,
                description: 'Waterproof adhesive bandages for minor cuts.',
                pack: 'Box (50 Strips)',
                image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200'
            },
            {
                name: 'Digital Thermometer',
                slug: 'digital-thermometer',
                category: 'first-aid',
                price: 499,
                description: 'Accurate and fast temperature reading.',
                pack: '1 Unit',
                image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200'
            },
            {
                name: 'Antiseptic Liquid',
                slug: 'antiseptic-liquid',
                category: 'first-aid',
                price: 120,
                description: 'Disinfectant for wounds and home hygiene.',
                pack: '500ml',
                image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200'
            },
            {
                name: 'Protein Powder Chocolate',
                slug: 'protein-powder-choc',
                category: 'supplements',
                price: 2500,
                description: 'Whey protein for muscle recovery.',
                pack: '1kg Jar',
                image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200'
            }
        ];

        for (const p of products) {
            // Find category ID
            const cat = subcats.find(c => c.slug === p.category);
            if (!cat) continue;

            const existing = await Product.findOne({ $or: [{ slug: p.slug }, { productName: p.name }] });
            if (!existing) {
                await Product.create({
                    productName: p.name,
                    slug: p.slug,
                    category: cat._id,
                    headerCategoryId: headerCat._id,
                    seller: seller._id,
                    price: p.price,
                    compareAtPrice: p.price * 1.2, // Dummy MRP
                    stock: 100,
                    description: p.description,
                    smallDescription: p.description,
                    pack: p.pack,
                    mainImage: p.image,
                    galleryImages: [p.image],
                    status: 'Active',
                    publish: true,
                    isReturnable: false,
                    rating: 4.5,
                    reviewsCount: 10,
                    tags: ['medicine', 'health', p.category],
                    variations: [{
                        name: 'Standard',
                        value: 'Standard',
                        price: p.price,
                        stock: 100,
                        status: 'Available'
                    }]
                });
                console.log(`Created Product: ${p.name}`);
            } else {
                console.log(`Product "${p.name}" already exists.`);
            }
        }

        console.log('Product seeding complete!');
        process.exit(0);

    } catch (error) {
        console.error('Product seeding failed:', error);
        process.exit(1);
    }
};

seedMedicineProducts();
