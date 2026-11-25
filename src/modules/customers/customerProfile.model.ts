import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export interface ICustomerProfile {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  notificationPreferences: {
    push: boolean;
    email: boolean;
    promotions: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type CustomerProfileDocument = HydratedDocument<ICustomerProfile>;

const customerProfileSchema = new Schema<ICustomerProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    notificationPreferences: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export const CustomerProfile = model<ICustomerProfile>(
  "CustomerProfile",
  customerProfileSchema
);