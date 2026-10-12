"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canCreateSellListing, canCreateBuyListing } from "@/config/permissions";
import type { Role } from "@/config/roles";
import { isCommunityAllowed } from "@/server/queries";

const listingSchema = z.object({
  type: z.enum(["BUY", "SELL"]),
  productId: z.string().min(1),
  communityId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  price: z.coerce.number().positive(),
  currency: z.string().min(1).default("LOCAL"),
  description: z.string().optional(),
});

export async function createListing(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const rawType = String(formData.get("type") ?? "").trim();
  const rawProductId = String(formData.get("productId") ?? "").trim();
  const rawCommunityId = String(formData.get("communityId") ?? "").trim();
  const rawQuantity = String(formData.get("quantity") ?? "").trim();
  const rawPrice = String(formData.get("price") ?? "").trim();
  const rawCurrency = String(formData.get("currency") ?? "").trim();
  const rawDescription = String(formData.get("description") ?? "").trim();

  const parsed = listingSchema.safeParse({
    type: rawType,
    productId: rawProductId,
    communityId: rawCommunityId,
    quantity: rawQuantity,
    price: rawPrice,
    currency: rawCurrency || "LOCAL",
    description: rawDescription || undefined,
  });

  if (!parsed.success) {
    redirect("/dashboard/market?error=validation");
  }

  // Verificar permisos según tipo de publicación
  if (parsed.data.type === "SELL") {
    if (!canCreateSellListing(session.role as Role)) {
      redirect("/dashboard/market?error=forbidden");
    }
  } else if (parsed.data.type === "BUY") {
    if (!canCreateBuyListing(session.role as Role)) {
      redirect("/dashboard/market?error=forbidden");
    }
  } else {
    redirect("/dashboard/market?error=validation");
  }

  const communityAllowed = await isCommunityAllowed(
    session,
    parsed.data.communityId
  );

  if (!communityAllowed) {
    redirect("/dashboard/market?error=community");
  }

  const productCount = await prisma.product.count({
    where: {
      id: parsed.data.productId,
    },
  });

  if (productCount === 0) {
    redirect("/dashboard/market?error=product");
  }

  try {
    await prisma.listing.create({
      data: {
        type: parsed.data.type,
        productId: parsed.data.productId,
        communityId: parsed.data.communityId,
        createdById: session.id,
        quantity: parsed.data.quantity,
        price: parsed.data.price,
        currency: parsed.data.currency,
        description: parsed.data.description,
        status: "OPEN",
      },
    });
  } catch {
    redirect("/dashboard/market?error=db");
  }

  revalidatePath("/dashboard/market");
  revalidatePath("/dashboard");

  redirect("/dashboard/market?created=1");
}
