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

export const createShopifyClient = (shopDomain: string, accessToken: string) => {
  if (!shopDomain.includes("myshopify.com")){
    shopDomain += ".myshopify.com";
  }
  const session = new Session({
    id: `offline_${shopDomain}`, // Standard ID format for offline tokens
    shop: shopDomain,
    state: 'state',
    isOnline: false, // We use offline tokens for background sync
    accessToken: accessToken,
    scope: 'read_products,read_orders,read_customers' // scopes i have access to
  });

  const client = new shopify.clients.Graphql({ session });
  //my shopify app must be involved , cause shopify api wont alow non shopify users to use their apis , through my app , i am able to get other tenants data
  return client;
};


export default shopify;
