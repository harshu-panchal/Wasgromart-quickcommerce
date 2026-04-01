import mongoose, { Document, Schema } from 'mongoose';

export interface IWithdrawRequest extends Document {
    userId: mongoose.Types.ObjectId;
    userType: 'SELLER' | 'DELIVERY_BOY';
    amount: number;
    status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
    paymentMethod: 'Bank Transfer' | 'UPI';
    accountDetails: string;
    remarks?: string;
    transactionReference?: string;
    processedBy?: mongoose.Types.ObjectId;
    processedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const WithdrawRequestSchema = new Schema<IWithdrawRequest>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            required: [true, 'User ID is required'],
            refPath: 'userType'
        },
        userType: {
            type: String,
            required: [true, 'User type is required'],
            enum: ['SELLER', 'DELIVERY_BOY'], // Enum values must match refPath
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [1, 'Minimum withdrawal amount is 1'],
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected', 'Completed'],
            default: 'Pending',
        },
        paymentMethod: {
            type: String,
            enum: ['Bank Transfer', 'UPI'],
            required: [true, 'Payment method is required'],
        },
        accountDetails: {
            type: String,
            required: [true, 'Account details are required'],
            trim: true,
        },
        remarks: {
            type: String,
            trim: true,
        },
        transactionReference: {
            type: String,
            trim: true,
        },
        processedBy: {
            type: Schema.Types.ObjectId,
            ref: 'Admin',
        },
        processedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

WithdrawRequestSchema.index({ userId: 1, userType: 1 });
WithdrawRequestSchema.index({ status: 1 });

const WithdrawRequest = mongoose.model<IWithdrawRequest>('WithdrawRequest', WithdrawRequestSchema);

export default WithdrawRequest;
