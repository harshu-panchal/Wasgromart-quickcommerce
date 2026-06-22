import mongoose, { Schema, Document } from "mongoose";

export interface ILowestPricesProduct extends Document {
    product: mongoose.Types.ObjectId;
    headerCategorySlug: string;
    order: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const LowestPricesProductSchema = new Schema<ILowestPricesProduct>(
    {
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: [true, "Product is required"],
        },
        headerCategorySlug: {
            type: String,
            required: [true, "Header category slug is required"],
            trim: true,
            lowercase: true,
        },
        order: {
            type: Number,
            required: [true, "Display order is required"],
            default: 0,
            min: [0, "Order cannot be negative"],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

LowestPricesProductSchema.index({ order: 1, isActive: 1 });
LowestPricesProductSchema.index({ isActive: 1 });
LowestPricesProductSchema.index({ headerCategorySlug: 1, isActive: 1, order: 1 });
LowestPricesProductSchema.index({ product: 1, headerCategorySlug: 1 }, { unique: true });

const LowestPricesProduct = mongoose.model<ILowestPricesProduct>("LowestPricesProduct", LowestPricesProductSchema);

export default LowestPricesProduct;
