import type { Types } from "mongoose";
import { connectDB, disconnectDB } from "@/config/db";
import type { IconKey } from "@/constants/catalog";
import { ServiceCategory } from "@/modules/catalog/category.model";
import { Service } from "@/modules/catalog/service.model";
import { TechnicianProfile } from "@/modules/technicians/technicianProfile.model";
import { slugify } from "@/utils/slug";

const KOBO = 100;
const DEFAULT_NOTE = "Final price is confirmed in your quote after we review the request.";

interface SeedService {
  name: string;
  // Naira, converted to kobo when saved
  price: number;
  minutes: number;
  description: string;
  featured?: boolean;
}

interface SeedCategory {
  name: string;
  iconKey: IconKey;
  description: string;
  services: SeedService[];
}

// Starting prices are a first guess for Nigerian cities. Adjust them in the dashboard.
const CATALOG: SeedCategory[] = [
  {
    name: "Plumbing",
    iconKey: "plumbing",
    description: "Leaks, blocked drains, taps, toilets and water systems.",
    services: [
      { name: "Leak repair (taps and pipes)", price: 8000, minutes: 90, featured: true, description: "Fix dripping taps, leaking pipes and loose joints." },
      { name: "Blocked drain clearing", price: 12000, minutes: 120, description: "Clear blocked sinks, showers and drains." },
      { name: "Toilet repair or replacement", price: 10000, minutes: 120, description: "Repair a faulty cistern or flush, or fit a new toilet." },
      { name: "Water heater installation", price: 18000, minutes: 150, description: "Fit a new water heater and test it before we leave." },
    ],
  },
  {
    name: "Electrical repairs",
    iconKey: "electrical",
    description: "Wiring faults, sockets, switches, lighting and fittings.",
    services: [
      { name: "Socket and switch repair", price: 5000, minutes: 60, description: "Replace or repair faulty sockets and switches." },
      { name: "Lighting installation", price: 8000, minutes: 90, featured: true, description: "Install ceiling lights, spotlights and outdoor lights." },
      { name: "Fault finding and rewiring", price: 25000, minutes: 240, description: "Trace tripping or dead circuits and rewire where needed." },
      { name: "Breaker and distribution board fix", price: 15000, minutes: 120, description: "Fix or replace breakers and distribution boards." },
    ],
  },
  {
    name: "Air conditioning",
    iconKey: "ac",
    description: "Installation, servicing, gas refills and repairs.",
    services: [
      { name: "AC servicing and cleaning", price: 12000, minutes: 90, featured: true, description: "Clean filters and coils so your AC cools properly." },
      { name: "AC installation (split unit)", price: 35000, minutes: 180, description: "Mount and connect a new split unit." },
      { name: "AC gas refill", price: 20000, minutes: 90, description: "Check for leaks and refill the gas." },
    ],
  },
  {
    name: "Home cleaning",
    iconKey: "cleaning",
    description: "Regular and deep cleaning for homes and apartments.",
    services: [
      { name: "Standard home cleaning", price: 25000, minutes: 240, featured: true, description: "Cleaning for homes up to two bedrooms." },
      { name: "Deep cleaning", price: 45000, minutes: 360, description: "Top to bottom cleaning, including kitchens and bathrooms." },
      { name: "Post-construction cleaning", price: 70000, minutes: 480, description: "Remove dust, paint and debris after building work." },
    ],
  },
  {
    name: "Generator repairs",
    iconKey: "generator",
    description: "Servicing and fixing petrol and diesel generators.",
    services: [
      { name: "Generator servicing", price: 15000, minutes: 120, featured: true, description: "Oil, filters and a full check of your generator." },
      { name: "Generator fault repair", price: 20000, minutes: 180, description: "Find and fix starting, power and noise problems." },
    ],
  },
  {
    name: "Painting",
    iconKey: "painting",
    description: "Interior and exterior painting and touch-ups.",
    services: [
      { name: "Single room painting", price: 60000, minutes: 480, description: "Prepare and paint one room, walls and ceiling." },
      { name: "Touch-ups and patch painting", price: 25000, minutes: 240, description: "Repair marks and cracks, then match the paint." },
    ],
  },
  {
    name: "Appliance repairs",
    iconKey: "appliance",
    description: "Fridges, washing machines, microwaves, cookers and more.",
    services: [
      { name: "Fridge and freezer repair", price: 15000, minutes: 120, description: "Fix cooling, noise and leaking problems." },
      { name: "Washing machine repair", price: 15000, minutes: 120, description: "Fix draining, spinning and water inlet faults." },
      { name: "Microwave and cooker repair", price: 10000, minutes: 90, description: "Repair heating and control faults." },
    ],
  },
  {
    name: "Carpentry",
    iconKey: "carpentry",
    description: "Doors, wardrobes, shelves and furniture repair.",
    services: [
      { name: "Door repair and fitting", price: 12000, minutes: 120, description: "Repair, adjust or fit interior and exterior doors." },
      { name: "Wardrobe and shelf fitting", price: 20000, minutes: 240, description: "Build and fit wardrobes, shelves and cabinets." },
    ],
  },
  {
    name: "Pest control",
    iconKey: "pest",
    description: "Fumigation and treatment for roaches, rodents, termites and more.",
    services: [
      { name: "Home fumigation", price: 25000, minutes: 120, featured: true, description: "Treat cockroaches, ants and other crawling insects." },
      { name: "Termite treatment", price: 60000, minutes: 240, description: "Treat and protect wood and walls from termites." },
    ],
  },
  {
    name: "General maintenance",
    iconKey: "maintenance",
    description: "Small repairs and odd jobs around the home.",
    services: [
      { name: "Handyman visit", price: 8000, minutes: 120, description: "Up to two hours of small repairs and odd jobs." },
      { name: "Furniture assembly", price: 10000, minutes: 120, description: "Assemble beds, tables, wardrobes and shelves." },
    ],
  },
];

async function main() {
  await connectDB();

  let categoriesAdded = 0;
  let servicesAdded = 0;
  let order = 0;

  for (const cat of CATALOG) {
    const slug = slugify(cat.name);

    // $setOnInsert means running this again never overwrites what an admin has edited
    const categoryResult = await ServiceCategory.updateOne(
      { slug },
      {
        $setOnInsert: {
          name: cat.name,
          description: cat.description,
          iconKey: cat.iconKey,
          isActive: true,
          sortOrder: order,
        },
      },
      { upsert: true }
    );
    if (categoryResult.upsertedCount) categoriesAdded++;
    order += 10;

    const category = await ServiceCategory.findOne({ slug }).select("_id");
    if (!category) throw new Error(`Category ${cat.name} was not saved`);

    for (const s of cat.services) {
      const result = await Service.updateOne(
        { slug: slugify(s.name) },
        {
          $setOnInsert: {
            category: category._id,
            name: s.name,
            description: s.description,
            startingPrice: s.price * KOBO,
            pricingNote: DEFAULT_NOTE,
            estimatedDurationMinutes: s.minutes,
            isActive: true,
            isAvailable: true,
            isFeatured: !!s.featured,
          },
        },
        { upsert: true }
      );
      if (result.upsertedCount) servicesAdded++;
    }
  }

  // Link existing technicians to categories by matching their specializations by name
  const categories = await ServiceCategory.find().select("name").lean();
  const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c._id]));

  const technicians = await TechnicianProfile.find().select("specializations");
  let linked = 0;

  for (const tech of technicians) {
    const ids = tech.specializations
      .map((name) => byName.get(name.toLowerCase()))
      .filter((id): id is Types.ObjectId => !!id);

    if (ids.length > 0) {
      await TechnicianProfile.updateOne({ _id: tech._id }, { $set: { serviceCategories: ids } });
      linked++;
    }
  }

  console.log(
    `Catalogue ready. Added ${categoriesAdded} categories and ${servicesAdded} services. ` +
      `Linked ${linked} technicians to their categories.`
  );
}

main()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });