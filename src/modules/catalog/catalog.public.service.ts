import { ApiError } from "@/utils/ApiError";
import { escapeRegex } from "@/utils/regex";
import { OBJECT_ID, type PublicServicesQuery } from "@/modules/catalog/catalog.schemas";
import { ServiceCategory } from "@/modules/catalog/category.model";
import { Service } from "@/modules/catalog/service.model";

// Active categories, each with the number of active services it holds
export function listCategories() {
  return ServiceCategory.aggregate([
    { $match: { isActive: true } },
    { $sort: { sortOrder: 1, name: 1 } },
    {
      $lookup: {
        from: Service.collection.name,
        let: { id: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$category", "$$id"] }, isActive: true } },
          { $count: "n" },
        ],
        as: "counts",
      },
    },
    { $addFields: { serviceCount: { $ifNull: [{ $arrayElemAt: ["$counts.n", 0] }, 0] } } },
    { $project: { counts: 0, createdAt: 0, updatedAt: 0, __v: 0 } },
  ]);
}

export async function listServices(q: PublicServicesQuery) {
  const categories = await ServiceCategory.find({ isActive: true }).select("_id slug").lean();
  let categoryIds = categories.map((c) => c._id);

  if (q.category) {
    const wanted = q.category;
    const match = OBJECT_ID.test(wanted)
      ? categories.find((c) => String(c._id) === wanted)
      : categories.find((c) => c.slug === wanted.toLowerCase());
    categoryIds = match ? [match._id] : [];
  }

  const filter: Record<string, unknown> = { isActive: true, category: { $in: categoryIds } };
  if (q.featured !== undefined) filter.isFeatured = q.featured;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), "i");
    filter.$or = [{ name: rx }, { description: rx }];
  }

  const [items, total] = await Promise.all([
    Service.find(filter)
      .sort({ isFeatured: -1, name: 1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate("category", "name slug iconKey")
      .select("-__v")
      .lean(),
    Service.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
  };
}

export async function getService(idOrSlug: string) {
  if (idOrSlug.length > 100) throw ApiError.notFound("Service not found");

  const service = await Service.findOne({
    isActive: true,
    ...(OBJECT_ID.test(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug.toLowerCase() }),
  })
    .select("-__v")
    .lean();

  if (!service) throw ApiError.notFound("Service not found");

  // A service in a hidden category is hidden too
  const category = await ServiceCategory.findOne({ _id: service.category, isActive: true })
    .select("name slug iconKey")
    .lean();
  if (!category) throw ApiError.notFound("Service not found");

  return { ...service, category };
}