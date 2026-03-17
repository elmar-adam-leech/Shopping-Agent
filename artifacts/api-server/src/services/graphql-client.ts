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
    }
  );

  if (!response.ok) {
    throw new Error(`Shopify GraphQL error: ${response.status}`);
  }

  const data = (await response.json()) as GraphQLResponse;
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
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
                  publishedAt
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
