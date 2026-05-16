import { Permission, PermissionGroup } from "../../../types/rbac";

export const PERMISSION_GROUPS: PermissionGroup[] = [
    {
        group: "Products",
        permissions: [
            { label: "Manage Categories", value: "manage_categories" },
            { label: "Manage Brands", value: "manage_brands" },
            { label: "Manage Products", value: "manage_products" },
            { label: "Manage Sellers", value: "manage_sellers" },
        ],
    },
    {
        group: "Delivery",
        permissions: [
            { label: "Manage Locations", value: "manage_locations" },
            { label: "Manage Coupons", value: "manage_coupons" },
            { label: "Manage Delivery Boys", value: "manage_delivery_boys" },
        ],
    },
    {
        group: "Finance",
        permissions: [
            { label: "Manage Wallet", value: "manage_wallet" },
            { label: "Manage Withdrawals", value: "manage_withdrawals" },
            { label: "View Seller Transactions", value: "view_seller_transactions" },
            { label: "Manage Cash Collection", value: "manage_cash_collection" },
        ],
    },
    {
        group: "Users & Misc",
        permissions: [
            { label: "Manage Users", value: "manage_users" },
            { label: "Manage Notifications", value: "manage_notifications" },
            { label: "Manage FAQ", value: "manage_faq" },
        ],
    },
    {
        group: "Orders",
        permissions: [
            { label: "Manage Orders", value: "manage_orders" },
            { label: "View Orders", value: "view_orders" },
            { label: "Update Order Status", value: "update_order_status" },
        ],
    },
    {
        group: "Promotions",
        permissions: [
            { label: "Manage Promotions", value: "manage_promotions" },
            { label: "Manage Banners", value: "manage_banners" },
        ],
    },
    {
        group: "Settings",
        permissions: [
            { label: "Manage Settings", value: "manage_settings" },
            { label: "Manage System Users", value: "manage_system_users" },
            { label: "Manage Roles", value: "manage_roles" },
        ],
    },
];

// Flat list for convenience
export const ALL_PERMISSIONS: Permission[] =
    PERMISSION_GROUPS.flatMap((g) => g.permissions);
