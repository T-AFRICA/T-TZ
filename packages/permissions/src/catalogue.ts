/**
 * The permission and role catalogue of the TRONIC central admin.
 *
 * One list, two readers: server code (this package) and the central admin
 * database (database/admin-migrations seeds the same keys; a database test
 * compares the two, so they cannot drift apart unnoticed).
 *
 * A permission is always checked together with a country: holding
 * "orders.update" in Tanzania says nothing about Kenya. Only the Master
 * Super Admin role is global.
 */

/** Country-scoped permissions: what an administrator may do inside one country. */
export const COUNTRY_PERMISSIONS = {
  "products.read": "See the country's products",
  "products.create": "Add products",
  "products.update": "Edit products, SKUs, prices and images",
  "products.publish": "Publish and unpublish products",
  "categories.manage": "Manage categories, subcategories and brands",
  "inventory.read": "See stock levels and history",
  "inventory.adjust": "Adjust stock",
  "orders.read": "See orders",
  "orders.update": "Move orders through their lifecycle and add notes",
  "customers.read": "See customer profiles and order history",
  "customers.support": "Record customer support activity",
  "content.read": "See website content",
  "content.edit": "Edit website content drafts",
  "content.publish": "Publish and unpublish website content",
  "promotions.read": "See promotions and campaigns",
  "promotions.manage": "Create and change promotions and campaigns",
  "reports.read": "See the country's reports",
  "staff.read": "See the country's administrators and their roles",
  "staff.manage": "Invite staff and assign or remove staff roles in the country",
  "audit.read": "See the country's audit log",
  "settings.read": "See the country's operational settings and service status",
  "settings.update": "Change the country's operational settings",
} as const;

/** Global permissions: held only through the Master Super Admin role. */
export const GLOBAL_PERMISSIONS = {
  "global.countries.manage": "Change country configuration and status",
  "global.services.manage": "Register and check country services",
  "global.admins.manage": "Create Country Super Admins, suspend and reinstate administrators",
  "global.audit.read": "See the audit log of every country and of global actions",
  "global.security.read": "See security events",
} as const;

export type CountryPermission = keyof typeof COUNTRY_PERMISSIONS;
export type GlobalPermission = keyof typeof GLOBAL_PERMISSIONS;
export type Permission = CountryPermission | GlobalPermission;

export const COUNTRY_PERMISSION_KEYS = Object.keys(COUNTRY_PERMISSIONS) as CountryPermission[];
export const GLOBAL_PERMISSION_KEYS = Object.keys(GLOBAL_PERMISSIONS) as GlobalPermission[];

export function isCountryPermission(value: string): value is CountryPermission {
  return Object.hasOwn(COUNTRY_PERMISSIONS, value);
}

export function isGlobalPermission(value: string): value is GlobalPermission {
  return Object.hasOwn(GLOBAL_PERMISSIONS, value);
}

export type RoleScope = "global" | "country";

/**
 * Who may give a role to someone:
 *   - "provisioning": nobody in the application. Only the privileged
 *     provisioning step run by the database owner (Master Super Admin).
 *   - "master": a Master Super Admin (Country Super Admin).
 *   - "country_super_admin": a Master Super Admin, or an administrator who
 *     holds staff.manage in that country (staff roles).
 */
export type RoleGrantableBy = "provisioning" | "master" | "country_super_admin";

export interface RoleDefinition {
  name: string;
  scope: RoleScope;
  grantableBy: RoleGrantableBy;
  /** Sign-in must reach the second factor (AAL2) before the role counts. */
  requiresMfa: boolean;
  /** Country permissions of the role. The master role holds every permission and lists none. */
  permissions: readonly CountryPermission[];
}

export const ROLES = {
  master_super_admin: {
    name: "Master Super Admin",
    scope: "global",
    grantableBy: "provisioning",
    requiresMfa: true,
    permissions: [],
  },
  country_super_admin: {
    name: "Country Super Admin",
    scope: "country",
    grantableBy: "master",
    requiresMfa: true,
    permissions: COUNTRY_PERMISSION_KEYS,
  },
  product_manager: {
    name: "Product Manager",
    scope: "country",
    grantableBy: "country_super_admin",
    requiresMfa: false,
    permissions: ["products.read", "products.create", "products.update", "products.publish", "categories.manage", "inventory.read"],
  },
  inventory_manager: {
    name: "Inventory Manager",
    scope: "country",
    grantableBy: "country_super_admin",
    requiresMfa: false,
    permissions: ["inventory.read", "inventory.adjust", "products.read"],
  },
  order_manager: {
    name: "Order Manager",
    scope: "country",
    grantableBy: "country_super_admin",
    requiresMfa: false,
    permissions: ["orders.read", "orders.update", "customers.read", "inventory.read", "products.read"],
  },
  content_manager: {
    name: "Content Manager",
    scope: "country",
    grantableBy: "country_super_admin",
    requiresMfa: false,
    permissions: ["content.read", "content.edit", "content.publish", "products.read"],
  },
  marketing_manager: {
    name: "Marketing Manager",
    scope: "country",
    grantableBy: "country_super_admin",
    requiresMfa: false,
    permissions: ["promotions.read", "promotions.manage", "content.read", "content.edit", "products.read", "reports.read"],
  },
  finance_viewer: {
    name: "Finance / Reporting Viewer",
    scope: "country",
    grantableBy: "country_super_admin",
    requiresMfa: false,
    permissions: ["reports.read", "orders.read"],
  },
  customer_support: {
    name: "Customer Support",
    scope: "country",
    grantableBy: "country_super_admin",
    requiresMfa: false,
    permissions: ["customers.read", "customers.support", "orders.read"],
  },
} as const satisfies Record<string, RoleDefinition>;

export type RoleKey = keyof typeof ROLES;

export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];
export const MASTER_ROLE: RoleKey = "master_super_admin";

export function isRoleKey(value: string): value is RoleKey {
  return Object.hasOwn(ROLES, value);
}

export function roleDefinition(role: RoleKey): RoleDefinition {
  return ROLES[role];
}

/** Roles that can be assigned inside a country, most senior first. */
export const COUNTRY_ROLE_KEYS = ROLE_KEYS.filter((key) => ROLES[key].scope === "country");
