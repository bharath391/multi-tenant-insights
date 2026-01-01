import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import numpy as np
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import datetime

# --- CONFIGURATION ---

# Load environment variables from the root .env file
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)


DATABASE_URL = os.environ.get("DATABASE_URL")
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")
FROM_EMAIL = "your_verified_sendgrid_email@example.com" # IMPORTANT: Change this to your email

# --- DATABASE OPERATIONS ---

def get_db_engine():
    """Establishes a connection to the PostgreSQL database using SQLAlchemy."""
    return create_engine(DATABASE_URL)

def fetch_data(engine, query):
    """Fetches data from the database using a pandas query."""
    return pd.read_sql_query(query, engine)

def update_customer_segments(engine, customer_segments):
    """Updates the customer table with the new segment."""
    with engine.begin() as conn:
        for _, row in customer_segments.iterrows():
            conn.execute(
                text("UPDATE \"Customer\" SET segment = :segment WHERE id = :id"),
                {"segment": row['segment'], "id": row['id']}
            )

# --- RFM CALCULATION ---

def calculate_rfm(orders_df):
    """Calculates Recency, Frequency, and Monetary values for each customer."""
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


# --- K-MEANS CLUSTERING ---

def get_customer_segments(rfm_df, n_clusters=5):
    """Performs K-Means clustering on RFM data to segment customers."""
    if rfm_df.empty or len(rfm_df) < n_clusters:
        print("Not enough data to perform clustering.")
        return None

    rfm_scaled = StandardScaler().fit_transform(rfm_df[['Recency', 'Frequency', 'Monetary']])
    
    kmeans = KMeans(n_clusters=n_clusters, init='k-means++', max_iter=300, n_init=10, random_state=0)
    clusters = kmeans.fit_predict(rfm_scaled)
    
    rfm_df['cluster'] = clusters
    
    # Determine segment names by analyzing cluster centroids
    centroids = kmeans.cluster_centers_
    # Lower Recency, Higher Frequency, Higher Monetary are better
    # We rank clusters based on these metrics
    centroid_scores = centroids[:, 2] + centroids[:, 1] - centroids[:, 0] 
    ordered_centroids = np.argsort(np.argsort(centroid_scores))
    
    # Define segment names - from best to worst
    segment_names = ["Champions", "Loyal Customers", "Potential Loyalists", "At-Risk", "Lost"]
    
    segment_map = {i: segment_names[ordered_centroids[i]] for i in range(n_clusters)}
    
    rfm_df['segment'] = rfm_df['cluster'].map(segment_map)
    
    return rfm_df[['id', 'segment']]

# --- EMAIL NOTIFICATION ---

def send_emails_to_segments(customer_segments, tenant_shop_name):
    """Sends targeted emails to different customer segments."""
    if not SENDGRID_API_KEY:
        print("SENDGRID_API_KEY not found. Skipping email sending.")
        return
        
    sg = SendGridAPIClient(SENDGRID_API_KEY)

    for _, customer in customer_segments.iterrows():
        # This is a placeholder for fetching customer email
        # In a real scenario, you'd join with the customer table to get the email
        customer_email = "customer@example.com" # Replace with actual email fetching
        
        subject = ""
        html_content = ""

        if customer['segment'] == 'Champions':
            subject = f"A Special Thank You from {tenant_shop_name}!"
            html_content = "<strong>Thank you for being one of our most loyal customers! Here's a special something for you.</strong>"
        elif customer['segment'] == 'At-Risk':
            subject = f"We Miss You at {tenant_shop_name}!"
            html_content = "<strong>It's been a while! We've missed you. Here's a 15% coupon to welcome you back.</strong>"
        # Add more `elif` blocks for other segments...

        if subject and customer_email != "customer@example.com":
            message = Mail(
                from_email=FROM_EMAIL,
                to_emails=customer_email,
                subject=subject,
                html_content=html_content)
            try:
                response = sg.send(message)
                print(f"Email sent to {customer_email}, status code: {response.status_code}")
            except Exception as e:
                print(f"Error sending email to {customer_email}: {e}")


# --- MAIN EXECUTION ---

def main():
    """Main function to run the customer segmentation process."""
    engine = None
    try:
        engine = get_db_engine()
        tenants = fetch_data(engine, 'SELECT id, "shopName" FROM "Tenant"')

        for _, tenant in tenants.iterrows():
            print(f"--- Processing tenant: {tenant['shopName']} ({tenant['id']}) ---")
            
            orders_query = f"SELECT id, \"customerId\", \"createdAt\", \"totalPrice\" FROM \"Order\" WHERE \"tenantId\" = '{tenant['id']}'"
            orders = fetch_data(engine, orders_query)
            
            if orders.empty:
                print("No orders found for this tenant. Skipping.")
                continue

            rfm_table = calculate_rfm(orders)
            customer_segments = get_customer_segments(rfm_table)

            if customer_segments is not None:
                update_customer_segments(engine, customer_segments)
                print(f"Successfully segmented {len(customer_segments)} customers.")
                
                # In a real implementation, you would fetch customer emails before sending
                # send_emails_to_segments(customer_segments, tenant['shopName'])
                print("Email sending is commented out. Uncomment and configure to enable.")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if engine:
            engine.dispose()
            print("Database connection closed.")

if __name__ == '__main__':
    main()
