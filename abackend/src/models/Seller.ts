import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export interface ISeller extends Document {
  // Authentication
  sellerName: string;
  password: string;
  email: string;
  mobile: string;

  // Store Info
  storeName: string;
  panCard?: string;
  category: string;
  taxName?: string;
  address: string;
  pincode?: string;
  taxNumber?: string;
  storeDescription?: string;
  storeBanner?: string;
  fssaiLicNo?: string;
  workingHours?: {
    open: string;
    close: string;
    offDays: string[];
  };
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };

  // Store Location Info
  city: string;
  serviceableArea?: string;
  searchLocation?: string;
  latitude?: string;
  longitude?: string;
  // GeoJSON location for geospatial queries
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  // Service radius in kilometers
  serviceRadiusKm?: number;
  // Service area mode: which geometry should be used for customer-facing range filtering
  serviceAreaMode?: 'radius' | 'polygon';
  // GeoJSON polygon describing the seller's manually-drawn service area
  serviceArea?: {
    type: 'Polygon';
    coordinates: number[][][]; // [[[lng, lat], ...]]
  };

  // Payment Details
  accountName?: string;
  bankName?: string;
  branch?: string;
  accountNumber?: string;
  ifsc?: string;

  // Documents (URLs pointing to cloud storage)
  profile?: string;
  idProof?: string;
  addressProof?: string;

  // Settings
  requireProductApproval: boolean;
  viewCustomerDetails: boolean;
  commission: number;
  commissionRate?: number; // Alias or specific rate

  // Status
  status: 'Approved' | 'Pending' | 'Rejected';
  balance: number;
  categories: string[];
  logo?: string;
  isShopOpen: boolean;
  fcmTokens?: string[];
  fcmTokenMobile?: string[];

  // Subscription (Razorpay) - used for paid seller features (e.g. chat support)
  subscription?: {
    isActive: boolean;
    status?: "Active" | "Cancelled" | "Expired";
    planId?: string;
    startDate?: Date;
    expiryDate?: Date;
    razorpaySubscriptionId?: string;
    razorpayCustomerId?: string;
    lastPaymentId?: string;
    lastInvoiceId?: string;
    cancelledAt?: Date;
  };

  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const SellerSchema = new Schema<ISeller>(
  {
    // Authentication
    sellerName: {
      type: String,
      required: [true, 'Seller name is required'],
      trim: true,
    },
    password: {
      type: String,
      required: false, // Password not required during signup
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Please enter a valid email address',
      },
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[0-9]{10}$/.test(v);
        },
        message: 'Mobile number must be 10 digits',
      },
    },

    // Store Info
    storeName: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
    },
    panCard: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    taxName: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      required: false,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    taxNumber: {
      type: String,
      trim: true,
    },
    storeDescription: {
      type: String,
      trim: true,
    },
    storeBanner: {
      type: String,
      trim: true,
    },
    fssaiLicNo: {
      type: String,
      trim: true,
    },
    workingHours: {
      open: { type: String },
      close: { type: String },
      offDays: [{ type: String }],
    },
    socialLinks: {
      facebook: { type: String },
      instagram: { type: String },
      twitter: { type: String },
    },

    // Store Location Info
    city: {
      type: String,
      required: false,
      trim: true,
    },
    serviceableArea: {
      type: String,
      trim: true,
    },
    searchLocation: {
      type: String,
      trim: true,
    },
    latitude: {
      type: String,
      trim: true,
    },
    longitude: {
      type: String,
      trim: true,
    },
    // GeoJSON location for geospatial queries
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
    // Service radius in kilometers (default: 10km if not specified)
    serviceRadiusKm: {
      type: Number,
      default: 10,
      min: [0.1, 'Service radius must be at least 0.1 km'],
      max: [100, 'Service radius cannot exceed 100 km'],
    },
    // Service area mode: which geometry the customer feed uses for this seller
    serviceAreaMode: {
      type: String,
      enum: ['radius', 'polygon'],
      default: 'radius',
    },
    // GeoJSON polygon for the manually-drawn service area
    serviceArea: {
      type: {
        type: String,
        enum: ['Polygon'],
      },
      coordinates: {
        type: [[[Number]]], // [[[lng, lat], ...]]
      },
    },

    // Payment Details
    accountName: {
      type: String,
      trim: true,
    },
    bankName: {
      type: String,
      trim: true,
    },
    branch: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      trim: true,
    },
    ifsc: {
      type: String,
      trim: true,
    },

    // Documents (URLs)
    profile: {
      type: String,
      trim: true,
    },
    idProof: {
      type: String,
      trim: true,
    },
    addressProof: {
      type: String,
      trim: true,
    },

    // Settings
    requireProductApproval: {
      type: Boolean,
      default: false,
    },
    viewCustomerDetails: {
      type: Boolean,
      default: false,
    },
    commission: {
      type: Number,
      required: [true, 'Commission is required'],
      default: 0,
      min: [0, 'Commission cannot be negative'],
    },
    commissionRate: {
      type: Number,
      min: [0, 'Commission rate cannot be negative'],
      max: [100, 'Commission rate cannot exceed 100%'],
    },

    // Status
    status: {
      type: String,
      enum: ['Approved', 'Pending', 'Rejected'],
      default: 'Pending',
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Balance cannot be negative'],
    },
    categories: {
      type: [String],
      default: [],
    },
    logo: {
      type: String,
      trim: true,
    },
    isShopOpen: {
      type: Boolean,
      default: true,
    },
    fcmTokens: {
      type: [String],
      default: [],
    },
    fcmTokenMobile: {
      type: [String],
      default: [],
    },

    // Subscription fields are additive and backward compatible.
    // Webhook handlers update these to make backend the source of truth.
    subscription: {
      isActive: { type: Boolean, default: false },
      status: { type: String, enum: ["Active", "Cancelled", "Expired"] },
      planId: { type: String, trim: true },
      startDate: { type: Date },
      expiryDate: { type: Date },
      razorpaySubscriptionId: { type: String, trim: true },
      razorpayCustomerId: { type: String, trim: true },
      lastPaymentId: { type: String, trim: true },
      lastInvoiceId: { type: String, trim: true },
      cancelledAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

// Returns true when the value is a structurally valid single-ring GeoJSON Polygon.
// Used to scrub malformed serviceArea objects before validation/save so that the
// 2dsphere index never sees garbage that would throw at insert/update time.
function isValidGeoPolygon(area: any): boolean {
  if (!area || area.type !== 'Polygon') return false;
  const coords = area.coordinates;
  if (!Array.isArray(coords) || coords.length < 1) return false;
  const ring = coords[0];
  if (!Array.isArray(ring) || ring.length < 4) return false;
  for (const point of ring) {
    if (!Array.isArray(point) || point.length !== 2) return false;
    const [lng, lat] = point;
    if (typeof lng !== 'number' || typeof lat !== 'number') return false;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return false;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

// Clean up incomplete/invalid location/serviceArea objects before validation to prevent Mongoose/MongoDB errors
SellerSchema.pre('validate', function (next) {
  if (this.location) {
    if (!this.location.coordinates || !Array.isArray(this.location.coordinates) || this.location.coordinates.length !== 2) {
      this.location = undefined;
    }
  }
  if (this.serviceArea && !isValidGeoPolygon(this.serviceArea)) {
    this.serviceArea = undefined;
  }
  next();
});

// Hash password before saving (only if password is provided)
SellerSchema.pre('save', async function (next) {
  // Update GeoJSON location from latitude/longitude strings if they've changed
  if (this.isModified('latitude') || this.isModified('longitude')) {
    const lat = parseFloat(this.latitude || '0');
    const lng = parseFloat(this.longitude || '0');
    
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      this.location = {
        type: 'Point' as const,
        coordinates: [lng, lat] // MongoDB expects [longitude, latitude]
      };
    }
  }

  // Clean up incomplete/invalid location objects before save to prevent MongoDB 2dsphere indexing errors
  if (this.location) {
    if (!this.location.coordinates || !Array.isArray(this.location.coordinates) || this.location.coordinates.length !== 2) {
      this.location = undefined;
    }
  }

  if (this.serviceArea && !isValidGeoPolygon(this.serviceArea)) {
    this.serviceArea = undefined;
  }

  // Skip password hashing if password is not provided or not modified
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password
SellerSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Create geospatial index on location field for efficient queries
SellerSchema.index({ location: '2dsphere' });
SellerSchema.index({ serviceArea: '2dsphere' });
SellerSchema.index({ status: 1 }); // Compound index for status + location queries

const Seller = mongoose.model<ISeller>('Seller', SellerSchema);

export default Seller;
