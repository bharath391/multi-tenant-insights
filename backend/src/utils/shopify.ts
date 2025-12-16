import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api';


const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SHOPIFY_SCOPES ? process.env.SHOPIFY_SCOPES.split(',') : ['read_products', 'read_orders', 'read_customers'],
  hostName: `localhost:${process.env.PORT}`,
  apiVersion: ApiVersion.October24,
  isEmbeddedApp: false, 
});

/**
 * Creates a GraphQL client for a specific tenant.
 * 
 * @param shopDomain - The myshopify.com domain of the tenant (e.g., "my-store.myshopify.com")
 * @param accessToken - The permanent access token stored in your database for this tenant
 */
export const createShopifyClient = (shopDomain: string, accessToken: string) => {
  // and already have the tokens in our DB.
  if (!shopDomain.includes("myshopify.com")){
     shopDomain += ".myshopify.com";
  }
  const session = new Session({
    id: `offline_${shopDomain}`, // Standard ID format for offline tokens
    shop: shopDomain,
    state: 'state',
    isOnline: false, // We use offline tokens for background sync
    accessToken: accessToken,
    scope: 'read_products,read_orders,read_customers' // The scopes you have access to
  });

  const client = new shopify.clients.Graphql({ session });
  return client;
};

export default shopify;
