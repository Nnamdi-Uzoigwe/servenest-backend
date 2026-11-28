import { Router, type Request } from "express";
import { authenticate } from "@/middleware/auth";
import { customerOnly } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { ApiError } from "@/utils/ApiError";
import { OBJECT_ID } from "@/modules/catalog/catalog.schemas";
import { createAddressSchema, updateAddressSchema } from "@/modules/addresses/address.schemas";
import * as addresses from "@/modules/addresses/address.service";

const router = Router();

router.use(authenticate, customerOnly);

function idParam(req: Request): string {
  const id = String(req.params.id);
  if (!OBJECT_ID.test(id)) throw ApiError.badRequest("Invalid id");
  return id;
}

router.get("/", async (req, res) => {
  res.json({ success: true, data: await addresses.listAddresses(req.auth!.userId) });
});

router.post("/", validate(createAddressSchema), async (req, res) => {
  const data = await addresses.createAddress(req.auth!.userId, req.body);
  res.status(201).json({ success: true, message: "Address saved", data });
});

router.patch("/:id", validate(updateAddressSchema), async (req, res) => {
  const data = await addresses.updateAddress(req.auth!.userId, idParam(req), req.body);
  res.json({ success: true, message: "Address updated", data });
});

router.delete("/:id", async (req, res) => {
  await addresses.deleteAddress(req.auth!.userId, idParam(req));
  res.json({ success: true, message: "Address deleted" });
});

export default router;