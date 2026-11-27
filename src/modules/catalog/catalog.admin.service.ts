import { ApiError } from "@/utils/ApiError";
import { escapeRegex } from "@/utils/regex";
import { slugify } from "@/utils/slug";
import { assertOwnedAsset, deleteAsset } from "@/services/cloudinary.service";
import { logAudit, type AuditContext } from "@/modules/audit/audit.service";
import type {
  AdminServicesQuery,
  CreateCategoryInput,
  CreateServiceInput,
  UpdateCategoryInput,
  UpdateServiceInput,
} from "@/modules/catalog/catalog.schemas";
import { ServiceCategory } from "@/modules/catalog/category.model";
import { Service } from "@/modules/catalog/service.model";

type Image = { url: string; publicId: string };

const defined = (o: object): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

async function uniqueSlug(name: string, isTaken: (slug: string) => Promise<boolean>) {
  const base = slugify(name) || "item";
  let slug = base;
  let n = 2;
  while (await isTaken(slug)) slug = `${base}-${n++}`;
  return slug;
}

// Works out what to do with an image on update: keep it, replace it, or remove it
function planImage(current: Image | undefined, incoming: Image | null | undefined, actorId: string) {
  if (incoming === undefined) return { set: undefined, unset: false, oldPublicId: undefined };

  if (incoming === null) {
    return { set: undefined, unset: true, oldPublicId: current?.publicId };
  }

  assertOwnedAsset("service_image", actorId, incoming);
  const replaced =
    current?.publicId && current.publicId !== incoming.publicId ? current.publicId : undefined;
  return { set: incoming, unset: false, oldPublicId: replaced };
}

function buildUpdate(fields: Record<string, unknown>, change: ReturnType<typeof planImage>) {
  const $set = { ...fields, ...(change.set ? { image: change.set } : {}) };
  const update: Record<string, Record<string, unknown>> = {};
  if (Object.keys($set).length > 0) update.$set = $set;
  if (change.unset) update.$unset = { image: 1 };
  return update;
}

// Categories

export function listCategories() {
  return ServiceCategory.aggregate([
    { $sort: { sortOrder: 1, name: 1 } },
    {
      $lookup: {
        from: Service.collection.name,
        localField: "_id",
        foreignField: "category",
        as: "svc",
      },
    },
    {
      $addFields: {
        serviceCount: { $size: "$svc" },
        activeServiceCount: {
          $size: { $filter: { input: "$svc", as: "s", cond: "$$s.isActive" } },
        },
      },
    },
    { $project: { svc: 0, __v: 0 } },
  ]);
}

export async function getCategory(id: string) {
  const category = await ServiceCategory.findById(id).select("-__v").lean();
  if (!category) throw ApiError.notFound("Category not found");
  return category;
}

export async function createCategory(input: CreateCategoryInput, ctx: AuditContext) {
  if (input.image) assertOwnedAsset("service_image", ctx.actorId, input.image);

  const slug = await uniqueSlug(input.name, async (s) => !!(await ServiceCategory.exists({ slug: s })));
  const doc = await ServiceCategory.create({ ...input, slug });

  await logAudit(ctx, {
    action: "category.created",
    entityType: "ServiceCategory",
    entityId: doc._id,
    metadata: { name: doc.name },
  });

  return doc.toObject();
}

export async function updateCategory(id: string, input: UpdateCategoryInput, ctx: AuditContext) {
  const existing = await ServiceCategory.findById(id).select("image").lean();
  if (!existing) throw ApiError.notFound("Category not found");

  const { image, ...rest } = input;
  const change = planImage(existing.image, image, ctx.actorId);

  const updated = await ServiceCategory.findByIdAndUpdate(id, buildUpdate(defined(rest), change), {
    new: true,
    runValidators: true,
  })
    .select("-__v")
    .lean();

  if (change.oldPublicId) void deleteAsset(change.oldPublicId);

  await logAudit(ctx, {
    action: "category.updated",
    entityType: "ServiceCategory",
    entityId: id,
    metadata: { fields: Object.keys(input), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) },
  });

  return updated;
}

export async function deleteCategory(id: string, ctx: AuditContext) {
  const category = await ServiceCategory.findById(id);
  if (!category) throw ApiError.notFound("Category not found");

  if (await Service.exists({ category: id })) {
    throw ApiError.conflict(
      "This category has services, so it can only be deactivated. Services are kept so past bookings keep their history."
    );
  }

  await category.deleteOne();
  if (category.image?.publicId) void deleteAsset(category.image.publicId);

  await logAudit(ctx, {
    action: "category.deleted",
    entityType: "ServiceCategory",
    entityId: id,
    metadata: { name: category.name },
  });
}

// Services

export async function listServices(q: AdminServicesQuery) {
  const filter: Record<string, unknown> = {};
  if (q.category) filter.category = q.category;
  if (q.status) filter.isActive = q.status === "active";
  if (q.availability) filter.isAvailable = q.availability === "available";
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), "i");
    filter.$or = [{ name: rx }, { description: rx }];
  }

  const [items, total] = await Promise.all([
    Service.find(filter)
      .sort({ name: 1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate("category", "name slug iconKey isActive")
      .select("-__v")
      .lean(),
    Service.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
  };
}

export async function getService(id: string) {
  const service = await Service.findById(id)
    .populate("category", "name slug iconKey isActive")
    .select("-__v")
    .lean();
  if (!service) throw ApiError.notFound("Service not found");
  return service;
}

export async function createService(input: CreateServiceInput, ctx: AuditContext) {
  if (!(await ServiceCategory.exists({ _id: input.category }))) {
    throw ApiError.badRequest("Category not found");
  }
  if (input.image) assertOwnedAsset("service_image", ctx.actorId, input.image);

  const slug = await uniqueSlug(input.name, async (s) => !!(await Service.exists({ slug: s })));
  const doc = await Service.create({ ...input, slug });

  await logAudit(ctx, {
    action: "service.created",
    entityType: "Service",
    entityId: doc._id,
    metadata: { name: doc.name },
  });

  return doc.toObject();
}

export async function updateService(id: string, input: UpdateServiceInput, ctx: AuditContext) {
  const existing = await Service.findById(id).select("image").lean();
  if (!existing) throw ApiError.notFound("Service not found");

  if (input.category && !(await ServiceCategory.exists({ _id: input.category }))) {
    throw ApiError.badRequest("Category not found");
  }

  const { image, ...rest } = input;
  const change = planImage(existing.image, image, ctx.actorId);

  const updated = await Service.findByIdAndUpdate(id, buildUpdate(defined(rest), change), {
    new: true,
    runValidators: true,
  })
    .select("-__v")
    .lean();

  if (change.oldPublicId) void deleteAsset(change.oldPublicId);

  await logAudit(ctx, {
    action: "service.updated",
    entityType: "Service",
    entityId: id,
    metadata: {
      fields: Object.keys(input),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.startingPrice !== undefined ? { startingPrice: input.startingPrice } : {}),
    },
  });

  return updated;
}