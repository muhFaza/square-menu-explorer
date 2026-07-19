# Full Stack Coding Challenge

**Per Diem – February 2025**

---

## **About Us**

**Website:** [https://tryperdiem.com](https://tryperdiem.com/)

Per Diem is a Y Combinator–backed restaurant technology startup that builds white-label mobile apps and web ordering platforms for restaurants. We serve 450+ merchants across 1,500+ locations, integrating primarily with Square POS systems.

**Press:**

* [TechCrunch: Per Diem raises $2.26M](https://techcrunch.com/2022/09/15/per-diem-raises-2-26m/)  
* [Business Insider: 49 Most Promising Fintech Startups (2024)](https://www.businessinsider.com/49-most-promising-fintech-startups-according-top-vc-investors-2024)

---

## **What We're Looking For**

* Clean, well-structured, production-quality code with comments and types  
* Strong TypeScript / JavaScript fundamentals  
* Experience working with third-party APIs (specifically Square)  
* Mobile-first, responsive design thinking  
* Comprehensive error handling and loading states  
* Writing tests and documentation is a must  
* Strong communication skills  
* No need to implement access control (ACL) unless you want to go the extra mile

**If something is taking longer than expected, just let us know.** We're assessing your skills — not trying to make your life miserable.

**Don't hesitate to ask questions\!** You won't be judged for asking, but you will be judged if you build the wrong thing.

---

## **Objective**

Build a **mobile-friendly web application** (full stack) that connects to the **Square Catalog API** and displays a restaurant's menu items — filtered by **location** and **menu category**.

This challenge evaluates your ability to:

1. Design and build a backend that securely proxies Square API calls  
2. Build a responsive, polished frontend  
3. Handle real-world API data (nested objects, relationships, pagination)  
4. Implement filtering, caching, and error handling  
5. Write clean, typed, well-documented code

---

## **Requirements**

### **1\. Backend — Square API Proxy**

Build a lightweight backend server that acts as a proxy to the Square Catalog and Locations APIs. **The Square access token must never be exposed to the frontend.**

**Endpoints to implement:**

#### **`GET /api/locations`**

* Fetch all locations from Square's [Locations API](https://developer.squareup.com/reference/square/locations-api/list-locations)  
* Return a simplified response with: `id`, `name`, `address`, `timezone`, and `status` (ACTIVE / INACTIVE)  
* Only return `ACTIVE` locations

#### **`GET /api/catalog?location_id=<LOCATION_ID>`**

* Fetch catalog items from Square's [Catalog API — SearchCatalogObjects](https://developer.squareup.com/reference/square/catalog-api/search-catalog-objects)  
* Use `object_types: ["ITEM"]` and `include_related_objects: true` to fetch items along with their categories and images  
* **Filter items** to only return items that are present at the given `location_id` (check `present_at_location_ids` or `present_at_all_locations` on each catalog object)  
* Return a structured response that groups items by their **category name**  
* Each item should include: `id`, `name`, `description`, `category` (name), `image_url`, `variations` (with `name` and `price`)

#### **`GET /api/catalog/categories?location_id=<LOCATION_ID>`**

* Return only the categories that have at least one item present at the given location  
* Each category: `id`, `name`, `item_count`

**Backend requirements:**

* All responses must be typed (TypeScript interfaces / types)  
* Implement proper error handling — if Square returns an error, don't just pass it through. Map it to a clean API error response  
* Add in-memory caching (or Redis if you want bonus points) with a reasonable TTL so repeated requests don't hammer the Square API  
* Handle pagination — Square may return a `cursor` for large catalogs. Your backend should handle this transparently  
* Add request logging (at minimum: method, path, status code, duration)

---

### **2\. Frontend — Menu Display**

Build a **mobile-friendly** single-page application that displays the menu.

#### **Location Selector**

* On load, fetch available locations from `/api/locations`  
* Show a dropdown or selector for the user to pick a location  
* Persist the selected location in `localStorage` so it survives page refresh

#### **Category Navigation**

* Fetch categories for the selected location from `/api/catalog/categories`  
* Display category tabs or a sidebar for navigation  
* Highlight the currently active category  
* Clicking a category scrolls to / filters the menu items

#### **Menu Items**

* Fetch items for the selected location from `/api/catalog`  
* Display items **grouped by category**  
* Each item card should show:  
  * Item name  
  * Description (truncated if long, with "Read more" expand)  
  * Image (if available; show a tasteful placeholder if not)  
  * Price (from the first variation, formatted as currency — e.g., `$12.50`)  
  * If multiple variations exist, show them (e.g., "Small $4.00 · Medium $5.00 · Large $6.00")

#### **UI Requirements**

* **Mobile-first**: must look great on a 375px-wide viewport  
* Loading skeletons or spinners while data is fetching  
* Error states with a retry button if an API call fails  
* Empty states (e.g., "No items found for this location")  
* Smooth transitions when switching locations or categories

---

### **3\. Search (Bonus)**

Add a search bar that filters menu items by name or description. This can be client-side filtering on the already-fetched data.

---

### **4\. Testing**

We want to make sure you’re able to write test and knows the difference between unit, integration and e2e tests.

### ---

### **5\. Environment & Configuration**

* Use a `.env` file (and `.env.example` committed to the repo) for:  
  * `SQUARE_ACCESS_TOKEN`  
  * `SQUARE_ENVIRONMENT` (`sandbox` or `production`)  
  * `PORT`  
* The app should start with a single command (e.g., `npm run dev`)  
* Include a `docker-compose.yml` if you'd like bonus points for containerization

---

## **Square API Setup**

1. Create a free Square Developer account at [https://developer.squareup.com](https://developer.squareup.com/)  
2. Create an application in the Developer Dashboard  
3. Use the **Sandbox** environment and its access token  
4. The Sandbox comes with test catalog data. You can also add your own test items via the [Sandbox Seller Dashboard](https://squareupsandbox.com/)

**Key Square API docs:**

* [Catalog API Overview](https://developer.squareup.com/docs/catalog-api/what-it-does)  
* [SearchCatalogObjects](https://developer.squareup.com/reference/square/catalog-api/search-catalog-objects)  
* [List Locations](https://developer.squareup.com/reference/square/locations-api/list-locations)  
* [Working with Catalog Images](https://developer.squareup.com/docs/catalog-api/cookbook/create-catalog-images)

**Tip:** When calling `SearchCatalogObjects`, set `include_related_objects: true` — this will include the `CatalogCategory` and `CatalogImage` objects referenced by each item in the `related_objects` array of the response. You'll need to join these by ID.

---

## **Deliverables**

1. **Push your code to GitHub** and share the link  
2. Include a **`README.md`** with:  
   * Setup and run instructions  
   * Architecture decisions and trade-offs  
   * Any assumptions or limitations  
   * Screenshots or a short Loom video showing the app  
3. **(Bonus)** Deploy it somewhere (Vercel, Railway, Render, etc.) and share the live URL

---

## **Evaluation Criteria**

| Criteria | Weight | What We're Looking For |
| :---- | :---- | :---- |
| **Code Quality** | 25% | Clean TypeScript, proper types, comments, consistent style |
| **API Integration** | 25% | Correct Square API usage, pagination handling, data mapping |
| **UI / UX** | 20% | Mobile-first design, loading/error/empty states, polish |
| **Architecture** | 15% | Separation of concerns, caching strategy, env config |
| **Testing & Docs** | 15% | Meaningful tests, clear README, setup instructions |

---

## **Bonus Points**

* Deploy the app to a live URL (not a must, you can just send us an invite to github repo)  
* Add Docker support (`docker-compose up` starts everything)  
* Implement server-side caching with cache invalidation  
* Add a search/filter bar for menu items  
* Add animations or micro-interactions  
* Implement [Square Webhook](https://developer.squareup.com/docs/webhooks/overview) listener for `catalog.version.updated` to bust the cache when the merchant updates their menu  
* Add dark mode toggle  
* Accessibility (ARIA labels, keyboard navigation, screen reader support)

---

## **Timeline**

We'd like to receive your submission within **5 days**. If you need more time, just let us know — we're flexible.

---
