import { LRUCache } from "./lru-cache";

interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
}

export async function shopifyGraphQL(
  storeDomain: string,
  storefrontToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await fetch(
    `https://${storeDomain}/api/2025-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": storefrontToken,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (!response.ok) {
    console.error(`[graphql] Shopify API returned ${response.status} for store="${storeDomain}"`);
    throw new Error(`Shopify API request failed (status ${response.status})`);
  }

  const data = (await response.json()) as GraphQLResponse;
  if (data.errors) {
    console.error(`[graphql] GraphQL errors for store="${storeDomain}":`, JSON.stringify(data.errors));
    throw new Error("Shopify GraphQL request returned errors");
  }

  return data.data || {};
}

export async function fetchBlogs(storeDomain: string, storefrontToken: string, limit = 5) {
  const query = `
    query ($limit: Int!) {
      blogs(first: $limit) {
        edges {
          node {
            id
            title
            handle
            articles(first: 5) {
              edges {
                node {
                  id
                  title
                  handle
                  excerpt
                  contentHtml
                  publishedAt
                  authorV2 {
                    name
                  }
                  image {
                    url
                    altText
                  }
                  blog {
                    title
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  return shopifyGraphQL(storeDomain, storefrontToken, query, { limit });
}

const metaobjectCache = new LRUCache<Record<string, unknown>>(100, 5 * 60 * 1000, "metaobjects");

export async function fetchMetaobjects(
  storeDomain: string,
  storefrontToken: string,
  typeHandle: string,
  limit = 10
): Promise<Record<string, unknown>> {
  const cacheKey = `${storeDomain}::${typeHandle}::${limit}`;
  const cached = metaobjectCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const query = `
    query ($type: String!, $limit: Int!) {
      metaobjects(type: $type, first: $limit) {
        edges {
          node {
            id
            type
            handle
            fields {
              key
              value
              type
            }
          }
        }
      }
    }
  `;
  const data = await shopifyGraphQL(storeDomain, storefrontToken, query, { type: typeHandle, limit });

  metaobjectCache.set(cacheKey, data);

  return data;
}

export async function fetchCollections(storeDomain: string, storefrontToken: string, limit = 10) {
  const query = `
    query ($limit: Int!) {
      collections(first: $limit) {
        edges {
          node {
            id
            title
            handle
            description
            image {
              url
              altText
            }
            products(first: 4) {
              edges {
                node {
                  id
                  title
                  handle
                  featuredImage {
                    url
                    altText
                  }
                  priceRange {
                    minVariantPrice {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  return shopifyGraphQL(storeDomain, storefrontToken, query, { limit });
}
