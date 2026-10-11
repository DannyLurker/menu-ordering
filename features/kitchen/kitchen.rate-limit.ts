import {
  KITCHEN_IP_MAX,
  KITCHEN_STAFF_MAX,
  clientIp,
  hitRateLimit,
  isRateLimited,
  kitchenIpKey,
  kitchenStaffKey,
  rateLimitRetryAfter,
  rateLimitedResponse,
} from "@/lib/rate-limit";

export function checkKitchenMutationRateLimit(
  userId: string,
  headers: Headers,
): Response | null {
  const ip = clientIp(headers);
  const staffKey = kitchenStaffKey(userId);
  const ipKey = kitchenIpKey(ip);

  if (isRateLimited(staffKey, KITCHEN_STAFF_MAX)) {
    return rateLimitedResponse(rateLimitRetryAfter(staffKey, KITCHEN_STAFF_MAX));
  }
  if (isRateLimited(ipKey, KITCHEN_IP_MAX)) {
    return rateLimitedResponse(rateLimitRetryAfter(ipKey, KITCHEN_IP_MAX));
  }

  hitRateLimit(staffKey, KITCHEN_STAFF_MAX);
  hitRateLimit(ipKey, KITCHEN_IP_MAX);
  return null;
}
