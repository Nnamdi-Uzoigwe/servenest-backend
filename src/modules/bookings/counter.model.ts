import { Schema, model } from "mongoose";

interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  { _id: { type: String }, seq: { type: Number, default: 0 } },
  { versionKey: false }
);

const Counter = model<ICounter>("Counter", counterSchema);

// One atomic step, so two requests at the same moment can never receive the same number
export async function nextSequence(name: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return doc.seq;
}