import { COUNTRY_ADMIN_ENDPOINTS, NOTIFICATION_AUDIENCES, NOTIFICATION_ENDPOINTS, type NotificationAudience } from "@tronic/api-contracts";
import { can, isCountryPermission, type Actor } from "@tronic/permissions";

/**
 * The notification audiences an administrator belongs to in one country:
 * "orders" with orders.read, "inventory" with inventory.read, and "rider"
 * for someone who holds the Rider role there (a super admin has the
 * permission too, but is not a rider and has no deliveries of their own).
 *
 * It decides what the console asks the country for. The country checks the
 * permission of every request again, from the signed token.
 */
export function notificationAudiences(actor: Actor, countryId: string): NotificationAudience[] {
  return NOTIFICATION_AUDIENCES.filter((audience) => {
    const permission: string = COUNTRY_ADMIN_ENDPOINTS[NOTIFICATION_ENDPOINTS[audience].list].permission;
    if (!isCountryPermission(permission) || !can(actor, permission, countryId)) return false;
    if (audience === "rider") return actor.assignments.some((assignment) => assignment.role === "rider" && assignment.countryId === countryId);
    return true;
  });
}
