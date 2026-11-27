import { Schema, model, type Types } from "mongoose";
import type { ICatalogImage } from "@/modules/catalog/category.model";

export interface IService {
  _id: Types.ObjectId;
  category: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  image?: ICatalogImage;
  // Whole kobo, so 850000 means 8,500 naira
  startingPrice: number;
  pricingNote: string;
  estimatedDurationMinutes: number;
  // Hidden from the catalogue when false
  isActive: boolean;
  // Visible but not bookable for now when false
  isAvailable: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const wholeNumber = {
  validator: (v: number) => Number.isInteger(v),
  message: "{PATH} must be a whole number",
};

const serviceSchema = new Schema<IService>(
  {
    category: { type: Schema.Types.ObjectId, ref: "ServiceCategory", required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    image: { url: String, publicId: String },
    startingPrice: { type: Number, required: true, min: 0, validate: wholeNumber },
    pricingNote: { type: String, default: "", trim: true, maxlength: 200 },
    estimatedDurationMinutes: {
      type: Number,
      required: true,
      min: 15,
      max: 1440,
      validate: wholeNumber,
    },
    isActive: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

serviceSchema.index({ category: 1, name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
serviceSchema.index({ isActive: 1, category: 1 });
serviceSchema.index({ isActive: 1, isFeatured: -1, name: 1 });

export const Service = model<IService>("Service", serviceSchema);