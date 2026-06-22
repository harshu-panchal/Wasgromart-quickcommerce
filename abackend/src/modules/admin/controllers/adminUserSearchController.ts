import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Customer from "../../../models/Customer";
import Seller from "../../../models/Seller";
import Delivery from "../../../models/Delivery";
import Admin from "../../../models/Admin";

type UserType = "Customer" | "Seller" | "Delivery" | "Admin";

interface SearchHit {
  userId: string;
  userType: UserType;
  displayName: string;
  phone?: string;
  email?: string;
}

const RESULT_LIMIT = 20;

/**
 * Escape regex metacharacters so admin-typed text is treated as a literal
 * substring (not a regex). Critical to avoid runaway patterns from input
 * like "(" or "?".
 */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegex(q: string) {
  return new RegExp(escapeRegex(q), "i");
}

/**
 * GET /admin/users/search?q=<text>&type=<Customer|Seller|Delivery|Admin>
 *
 * Used by the Admin → Notification page to pick a single user when the
 * "Specific User" target is chosen. Returns up to 20 results (5 per type when
 * `type` is omitted) shaped uniformly so the UI doesn't have to special-case
 * per-collection field names.
 */
export const searchUsers = asyncHandler(
  async (req: Request, res: Response) => {
    const rawQ = (req.query.q as string | undefined) || "";
    const q = rawQ.trim();
    const type = req.query.type as UserType | undefined;

    if (q.length < 2) {
      return res.status(200).json({
        success: true,
        message: "Provide at least 2 characters to search",
        data: [],
      });
    }

    const re = buildRegex(q);

    const wantCustomer = !type || type === "Customer";
    const wantSeller = !type || type === "Seller";
    const wantDelivery = !type || type === "Delivery";
    const wantAdmin = !type || type === "Admin";

    // When `type` is omitted we split the result budget across collections so
    // each one gets a fair share of the dropdown.
    const perTypeLimit = type ? RESULT_LIMIT : Math.ceil(RESULT_LIMIT / 4);

    const tasks: Array<Promise<SearchHit[]>> = [];

    if (wantCustomer) {
      tasks.push(
        Customer.find({
          $or: [
            { name: re },
            { phone: re },
            { email: re },
          ],
        })
          .select("name phone email")
          .limit(perTypeLimit)
          .lean()
          .then((docs) =>
            (docs as any[]).map((d) => ({
              userId: String(d._id),
              userType: "Customer" as const,
              displayName: d.name || "(no name)",
              phone: d.phone,
              email: d.email,
            })),
          ),
      );
    }

    if (wantSeller) {
      tasks.push(
        Seller.find({
          $or: [
            { sellerName: re },
            { storeName: re },
            { mobile: re },
            { email: re },
          ],
        })
          .select("sellerName storeName mobile email")
          .limit(perTypeLimit)
          .lean()
          .then((docs) =>
            (docs as any[]).map((d) => ({
              userId: String(d._id),
              userType: "Seller" as const,
              displayName:
                d.storeName && d.sellerName
                  ? `${d.sellerName} (${d.storeName})`
                  : d.sellerName || d.storeName || "(no name)",
              phone: d.mobile,
              email: d.email,
            })),
          ),
      );
    }

    if (wantDelivery) {
      tasks.push(
        Delivery.find({
          $or: [
            { name: re },
            { mobile: re },
            { email: re },
          ],
        })
          .select("name mobile email")
          .limit(perTypeLimit)
          .lean()
          .then((docs) =>
            (docs as any[]).map((d) => ({
              userId: String(d._id),
              userType: "Delivery" as const,
              displayName: d.name || "(no name)",
              phone: d.mobile,
              email: d.email,
            })),
          ),
      );
    }

    if (wantAdmin) {
      tasks.push(
        Admin.find({
          $or: [
            { firstName: re },
            { lastName: re },
            { mobile: re },
            { email: re },
          ],
        })
          .select("firstName lastName mobile email")
          .limit(perTypeLimit)
          .lean()
          .then((docs) =>
            (docs as any[]).map((d) => ({
              userId: String(d._id),
              userType: "Admin" as const,
              displayName:
                [d.firstName, d.lastName].filter(Boolean).join(" ") ||
                "(no name)",
              phone: d.mobile,
              email: d.email,
            })),
          ),
      );
    }

    const grouped = await Promise.all(tasks);
    const results = grouped.flat().slice(0, RESULT_LIMIT);

    return res.status(200).json({
      success: true,
      message: "User search results",
      data: results,
    });
  },
);
