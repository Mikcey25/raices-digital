import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getListings, getActiveListings } from "@/server/queries-market";
import { getProducts, getCommunitiesForUser } from "@/server/queries";
import { canCreateSellListing, canCreateBuyListing } from "@/config/permissions";
import { createListing } from "@/server/actions/listings";
import { updateListingStatus } from "@/server/actions/listing-status";
import type { Role } from "@/config/roles";
import { formatDateTime, formatMoney } from "@/lib/utils";

export default async function MarketPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [allListings, activeListings, products, communities] = await Promise.all([
    getListings(session),
    getActiveListings(session),
    getProducts(),
    getCommunitiesForUser(session),
  ]);

  const canCreateSell = canCreateSellListing(session.role as Role);
  const canCreateBuy = canCreateBuyListing(session.role as Role);
  const canCreate = canCreateSell || canCreateBuy;

  const sellListings = allListings.filter((l) => l.type === "SELL");
  const buyListings = allListings.filter((l) => l.type === "BUY");

  const created = searchParams.created === "1";
  const updated = searchParams.updated === "1";

  const errorCode =
    typeof searchParams.error === "string" ? searchParams.error : undefined;

