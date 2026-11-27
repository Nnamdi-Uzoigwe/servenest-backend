import { Schema, model, type Types } from "mongoose";
import { ICON_KEYS, type IconKey } from "@/constants/catalog";

export interface ICatalogImage {
  url: string;
  publicId: string;
}

export interface IServiceCategory {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  iconKey: IconKey;
  image?: ICatalogImage;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<IServiceCategory>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "", trim: true, maxlength: 300 },
    iconKey: { type: String, enum: ICON_KEYS, default: "other" },
    image: { url: String, publicId: String },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, min: 0, max: 1000 },
  },
  { timestamps: true }
);

// Names are unique, and capital letters do not count as a difference
categorySchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
categorySchema.index({ isActive: 1, sortOrder: 1, name: 1 });

export const ServiceCategory = model<IServiceCategory>("ServiceCategory", categorySchema);