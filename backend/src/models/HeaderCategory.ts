import mongoose, { Schema, Document } from 'mongoose';

export interface IHeaderCategory extends Document {
    name: string;
    iconLibrary: string;
    iconName: string;
    slug: string;
    relatedCategory?: string; // Links to a product category
    order: number;
    status: 'Published' | 'Unpublished';
    commissionRate?: number;
    createdAt: Date;
    updatedAt: Date;
}

const HeaderCategorySchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        iconLibrary: { type: String, required: true },
        iconName: { type: String, required: true },
        slug: { type: String, required: true, unique: true },
        relatedCategory: { type: String, required: false },
        order: { type: Number, default: 0 },
        status: { type: String, enum: ['Published', 'Unpublished'], default: 'Published' },
        commissionRate: {
            type: Number,
            min: [0, 'Commission rate cannot be negative'],
            max: [100, 'Commission rate cannot exceed 100%'],
            default: 0,
        },
    },
    { timestamps: true }
);

export default mongoose.model<IHeaderCategory>('HeaderCategory', HeaderCategorySchema);
