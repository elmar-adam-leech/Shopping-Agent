const USER_FRIENDLY_ERRORS: Record<string, string> = {
  "Missing shop parameter": "Please provide a valid store domain.",
  "Invalid shop domain. Must be a valid .myshopify.com domain.":
    "That doesn't look like a valid Shopify store domain. Please check and try again.",
  "Server is busy, please try again later":
    "The server is currently busy. Please wait a moment and try again.",
};

const HTTP_STATUS_ERRORS: Record<number, string> = {
  429: "Too many messages sent. Please wait a moment before trying again.",
  503: "The service is temporarily unavailable. Please try again in a moment.",
};

export function toFriendlyError(raw: string): string {
  if (USER_FRIENDLY_ERRORS[raw]) return USER_FRIENDLY_ERRORS[raw];
  if (/not configured|SHOPIFY_API_KEY|SHOPIFY_API_SECRET|APP_URL/i.test(raw)) {
    return "The app is not fully configured yet. Please contact the site administrator.";
  }
  return "Something went wrong. Please try again later.";
}

export function httpStatusToError(status: number): string {
  return HTTP_STATUS_ERRORS[status] || "Something went wrong. Please try again.";
}
