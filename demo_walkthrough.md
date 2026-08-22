# 🎥 GlobeTrotter Demo Video Script & PostgreSQL Real-Time Telemetry Guide

This document is your step-by-step recording guide to record a high-impact demo video of **GlobeTrotter**. It showcases frontend interactions, authentication flows, admin RBAC protections, and real-time database row insertions/updates in PostgreSQL (pgAdmin / DBeaver / TablePlus / psql).

---

## 🎬 Video Recording Plan Overview

| Scene | Duration | Feature / Flow Demonstrated | PostgreSQL Live Query / Table |
|---|---|---|---|
| **Scene 1** | 0:00 - 0:30 | **Interactive Auth Gateway** (`index.html`) | `SELECT id, username, email, role, created_at FROM users;` |
| **Scene 2** | 0:30 - 1:15 | **User Signup & Live Postgres Row Insertion** | Observe new row with hashed password in `users` table |
| **Scene 3** | 1:15 - 2:00 | **Regular User Dashboard & Admin Tab Hidden** | Verify `role = 'user'`, Admin nav tab is invisible |
| **Scene 4** | 2:00 - 3:00 | **Multi-City Trip Creation & Budget Triggers** | `trips`, `trip_stops`, `itinerary_items` & budget sync |
| **Scene 5** | 3:00 - 3:45 | **Admin Login (`admin1234@temporaryaccount.none`)** | Admin navigation tab unlocked, analytics dashboard |
| **Scene 6** | 3:45 - 4:15 | **Security Guard Test (RBAC Violation Blocked)** | Direct URL access to `admin.html` blocked for users |

---

## 🛠️ Step-by-Step Recording Script & SQL Commands

### 🌟 Pre-Recording Setup
1. **Start the Backend** (or open `frontend/index.html` in your browser):
   ```bash
   npm run dev
   ```
2. **Open your PostgreSQL Client** (pgAdmin, DBeaver, or psql terminal) split-screen side-by-side with your browser.

---

### 📍 Scene 1: First-Time User Experience & Auth Gateway
**What to show on screen:**
1. Open `frontend/index.html` in your browser (e.g., in Chrome/Brave).
2. Because no user is logged in, the **Auth Gateway Modal** automatically appears with clean tab toggles: **[Login]** and **[Sign Up]**.
3. Point out the professional travel design, manual email authentication requirement (no Google OAuth dependency), and the clear tab switching.

---

### 📍 Scene 2: Live Signup & PostgreSQL Row Insertion
**What to show on screen:**
1. On the Auth Modal, click the **Sign Up** tab.
2. Enter the new traveler details:
   - **First Name**: `Aarav`
   - **Last Name**: `Mehta`
   - **Email**: `aarav.mehta@traveler.com`
   - **Password**: `ExplorerPass2026!`
   - **City**: `Mumbai, India`
3. Click **Create Free Account**.
4. **Switch to PostgreSQL Dashboard** and execute:
   ```sql
   SELECT id, username, email, first_name, last_name, role, status, has_verified_email, created_at 
   FROM users 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
5. **Call out to viewers**:
   - The new row for `aarav.mehta@traveler.com` appears instantly.
   - The password is saved as a secure Argon2id cryptographic hash (`$argon2id$...`).
   - The assigned role is `user`.

---

### 📍 Scene 3: Regular User Navigation & Strict Admin Tab Privacy
**What to show on screen:**
1. The browser refreshes into the logged-in state.
2. In the top navigation bar, show the authenticated user badge in the top right (`Aarav`).
3. Notice that the navigation items are: `Home`, `My Trips`, `Explore`, `Community`, `Calendar`, `Profile`.
4. **Point out**: The **Admin** tab is **completely hidden** from regular travelers.
5. If the user tries to manually navigate to `admin.html` in the address bar:
   - An alert appears: *"Access Denied: The Admin Panel is restricted to system administrators (admin1234@temporaryaccount.none)."*
   - The user is safely redirected back to `index.html`.

---

### 📍 Scene 4: Trip Creation, Itinerary Building & Budget Trigger Sync
**What to show on screen:**
1. Click **+ New Trip** or go to `create-trip.html`.
2. Enter:
   - **Trip Title**: `Golden Triangle Heritage Circuit`
   - **Destination**: `Jaipur & Udaipur`
   - **Dates**: `2026-10-10` to `2026-10-17`
   - **Target Budget**: `₹45,000`
3. Select 2 activity suggestions (*Amber Fort Palace Guided Tour* and *Lake Pichola Sunset Boat Ride*).
4. Click **Proceed to Itinerary Builder** (`build-itinerary.html`).
5. Add an activity expense (€50 / ₹4,500) and move a stop order.
6. **Switch to PostgreSQL Dashboard** and execute:
   ```sql
   -- View created trip and stop records
   SELECT t.id, t.name, t.start_date, t.end_date, t.estimated_budget_total, t.status, COUNT(s.id) as total_stops
   FROM trips t
   LEFT JOIN trip_stops s ON s.trip_id = t.id
   GROUP BY t.id, t.name, t.start_date, t.end_date, t.estimated_budget_total, t.status
   ORDER BY t.created_at DESC LIMIT 1;
   ```
7. **Call out to viewers**:
   - The PostgreSQL database trigger `refresh_trip_budget_cache()` automatically calculated and stored `estimated_budget_total` across all stops and line items in real time.

---

### 📍 Scene 5: Administrator Login (`admin1234@temporaryaccount.none`)
**What to show on screen:**
1. Click the Logout icon in the top header.
2. The Auth Modal opens. Click **Login** and enter:
   - **Email**: `admin1234@temporaryaccount.none`
   - **Password**: `AdminPassword123!`
3. Click **Sign In to GlobeTrotter**.
4. **Observe the changes**:
   - Header shows **GlobeTrotter Admin** badge.
   - The **Admin** navigation tab is now **unlocked and visible**.
5. Click **Admin** $\rightarrow$ opens `admin.html`.
6. Demonstrate the 4 Admin management tabs:
   - **Tab 1: Manage Users** (User roles, status, SVG analytics).
   - **Tab 2: Popular Cities** (Top visited circuits: Paris, Tokyo, NYC, Rome, Barcelona).
   - **Tab 3: Popular Activities** (Top booked excursions).
   - **Tab 4: User Trends and Analytics** (Quarterly growth).

---

## 🚀 How to Push this Clean Project to GitHub

Run these commands in your PowerShell or terminal to push your repository:

```powershell
# 1. Check current status
git status

# 2. Stage the newly added styles, auth gateway, and demo guide
git add .

# 3. Commit the changes
git commit -m "feat: Add interactive Auth Gateway on index.html, admin RBAC guards, and demo telemetry guide"

# 4. Push directly to your GitHub repository
git push origin main
```

*(Or open **GitHub Desktop** and click **"Push origin"**).*
