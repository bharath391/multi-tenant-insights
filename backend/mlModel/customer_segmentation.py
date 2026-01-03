import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import numpy as np
import datetime
import sys

dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

DATABASE_URL = os.environ.get("DATABASE_URL")

def get_db_engine():
    return create_engine(DATABASE_URL)

def fetch_data(engine, query):
    return pd.read_sql_query(query, engine)

def update_customer_segments(engine, customer_segments):
    with engine.begin() as conn:
        for _, row in customer_segments.iterrows():
            conn.execute(
                text("UPDATE \"Customer\" SET segment = :segment WHERE id = :id"),
                {"segment": row['segment'], "id": row['id']}
            )

def calculate_rfm(orders_df):
    snapshot_date = orders_df['createdAt'].max() + datetime.timedelta(days=1)
    
    rfm = orders_df.groupby('customerId').agg({
        'createdAt': lambda date: (snapshot_date - date.max()).days,
        'id': 'count',
        'totalPrice': 'sum'
    })

    rfm.rename(columns={'createdAt': 'Recency',
                        'id': 'Frequency',
                        'totalPrice': 'Monetary'}, inplace=True)
    
    return rfm.reset_index().rename(columns={'customerId': 'id'})

def get_customer_segments(rfm_df, n_clusters=5):
    if rfm_df.empty or len(rfm_df) < n_clusters:
        return None

    rfm_scaled = StandardScaler().fit_transform(rfm_df[['Recency', 'Frequency', 'Monetary']])
    
    kmeans = KMeans(n_clusters=n_clusters, init='k-means++', max_iter=300, n_init=10, random_state=0)
    clusters = kmeans.fit_predict(rfm_scaled)
    
    rfm_df['cluster'] = clusters
    
    centroids = kmeans.cluster_centers_
    centroid_scores = centroids[:, 2] + centroids[:, 1] - centroids[:, 0] 
    ordered_centroids = np.argsort(np.argsort(centroid_scores))
    
    segment_names = ["Champions", "Loyal Customers", "Potential Loyalists", "At-Risk", "Lost"]
    segment_map = {i: segment_names[ordered_centroids[i]] for i in range(n_clusters)}
    
    rfm_df['segment'] = rfm_df['cluster'].map(segment_map)
    
    return rfm_df[['id', 'segment']]

def main():
    target_tenant_id = sys.argv[1] if len(sys.argv) > 1 else None
    engine = None
    
    try:
        engine = get_db_engine()
        
        if target_tenant_id:
            tenants = fetch_data(engine, f"SELECT id, \"shopName\" FROM \"Tenant\" WHERE id = '{target_tenant_id}'")
        else:
            tenants = fetch_data(engine, 'SELECT id, "shopName" FROM "Tenant"')

        if tenants.empty:
            return

        for _, tenant in tenants.iterrows():
            orders_query = f"SELECT id, \"customerId\", \"createdAt\", \"totalPrice\" FROM \"Order\" WHERE \"tenantId\" = '{tenant['id']}'"
            orders = fetch_data(engine, orders_query)
            
            if orders.empty:
                continue

            rfm_table = calculate_rfm(orders)
            customer_segments = get_customer_segments(rfm_table)

            if customer_segments is not None:
                update_customer_segments(engine, customer_segments)

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if engine:
            engine.dispose()

if __name__ == '__main__':
    main()
