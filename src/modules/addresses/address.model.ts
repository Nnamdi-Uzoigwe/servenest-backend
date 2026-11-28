import { Schema, model, type Types } from "mongoose";

export interface ISavedAddress {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  label: string;
  street: string;
  landmark: string;
  city: string;
  state: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<ISavedAddress>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, required: true, trim: true, maxlength: 30 },
    street: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
    landmark: { type: String, default: "", trim: true, maxlength: 120 },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    state: { type: String, required: true, trim: true, maxlength: 50 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

addressSchema.index({ user: 1, createdAt: 1 });
// At most one default address per person, enforced by the database itself
addressSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

export const SavedAddress = model<ISavedAddress>("SavedAddress", addressSchema);