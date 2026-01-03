# Multi-Tenant Insights: System Architecture & Workflow

## Overview
This document outlines the backend architecture for the Multi-Tenant Insights platform. It details the flow from data synchronization to Machine Learning analysis and finally to automated marketing actions.

## 1. Data Synchronization Pipeline (Fan-Out)
**Goal**: Fetch Products, Customers, and Orders from Shopify for a specific tenant and store them in the database.

- **Entry Point**: `POST /v1/sync/:tenantId` (in `src/controllers/datasync.controller.ts`)
- **Initialization**:
    1.  Verifies tenant validity.
    2.  Sets a **Redis Counter** (`sync_status:${tenantId}`) to `3` (representing Products, Customers, Orders).
    3.  Dispatches 3 parallel jobs to `syncReqQueue` (one for each category).

## 2. Worker Processing (Fan-In)
### Sync Request Worker
- **File**: `src/workers/sync.req.worker.ts`
- **Role**: Fetches data from Shopify.
- **Logic**:
    - Iterates through Shopify GraphQL pagination.
    - Pushes data batches to `syncDbQueue` for storage.
    - **Completion Signal**: Once all pages for a category are processed, it pushes a special `categorySynced` job to `syncDbQueue`.

### Sync DB Worker
- **File**: `src/workers/sync.db.worker.ts`
- **Role**: Writes data to Postgres.
- **Logic**:
    - `processOrders/Products/Customers`: Upserts data into the database using Prisma.
    - `categorySynced`:
        - Decrements the Redis counter via `DECR`.
        - **Trigger Condition**: When the counter reaches `0`, it means **Full Sync is Complete**.
        - Updates tenant status: `isSyncing = false`.
        - **Action**: Pushes a job to `analyticsQueue` to start the ML model.

## 3. ML Model Integration
- **Worker**: `src/workers/analytics.worker.ts`
- **Queue**: `analyticsQueue`
- **Logic**:
    - Picks up the `generateInsights` job.
    - Calls `src/scripts/run_ml_model.ts`.
    - Spawns a child process to run `mlModel/customer_segmentation.py` with the `tenantId`.
    - **Python Script Actions**:
        1.  Fetches tenant's orders from DB.
        2.  Calculates RFM (Recency, Frequency, Monetary) metrics.
        3.  Runs K-Means clustering.
        4.  Updates the `Customer` table with segments (e.g., "Champions", "At-Risk").
    - **Completion**: Upon success, pushes a job to `mailQueue`.

## 4. Automated Marketing System
- **Worker**: `src/workers/mail.worker.ts`
- **Queue**: `mailQueue`
- **Logic**:
    1.  Fetches all customers for the given `tenantId`.
    2.  Iterates through customers and checks their `segment`.
    3.  Sends targeted emails using `src/utils/sendgrid.ts`:
        - **Champions / Loyal Customers**: Sends `sendRewardEmail` (VIP Discount).
        - **At-Risk / Lost**: Sends `sendRetentionEmail` (Win-back Offer).

## Infrastructure Components
| Component | Purpose |
|---|---|
| **Redis** | Manages queues (BullMQ) and atomic counters for sync tracking. |
| **BullMQ** | Handles asynchronous job processing and retries. |
| **Prisma** | ORM for PostgreSQL database interactions. |
| **Python** | Executes the data science/ML clustering logic. |
