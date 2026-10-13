"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Roles } from "@/config/roles";
import { isListingAllowed } from "@/server/queries-market";

const updateListingStatusSchema = z.object({
  listingId: z.string().min(1),
  status: z.enum(["OPEN", "CLOSED", "CANCELLED"]),
});

export async function updateListingStatus(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const rawListingId = String(formData.get("listingId") ?? "").trim();
  const rawStatus = String(formData.get("status") ?? "").trim();

  const parsed = updateListingStatusSchema.safeParse({
    listingId: rawListingId,
    status: rawStatus,
  });

  if (!parsed.success) {
    redirect("/dashboard/market?error=validation");
  }

  const listingAllowed = await isListingAllowed(session, parsed.data.listingId);

  if (!listingAllowed) {
    redirect("/dashboard/market?error=listing");
  }

  // Verificar que el usuario sea el creador o ADMIN
  const listing = await prisma.listing.findUnique({
    where: {
      id: parsed.data.listingId,
    },
    select: {
      createdById: true,
    },
  });

  if (!listing) {
    redirect("/dashboard/market?error=listing");
  }

  if (listing.createdById !== session.id && session.role !== Roles.ADMIN) {
    redirect("/dashboard/market?error=forbidden");
  }

