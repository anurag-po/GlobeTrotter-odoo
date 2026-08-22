import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { MemoryStore } from '../../src/infrastructure/db/memory-store.js';
import { createMemoryRepositories } from '../../src/infrastructure/db/repositories/index.js';

describe('GlobeTrotter End-to-End API Integration Suite', () => {
  let app: ReturnType<typeof createApp>;
  let store: MemoryStore;
  let authToken: string;
  let userId: string;
  let adminToken: string;
  let adminUserId: string;

  beforeEach(async () => {
    store = new MemoryStore();
    const repos = createMemoryRepositories(store);
    app = createApp({ repos });

    // 1. Register regular test user
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'test_wanderer',
        email: 'wanderer@globetrotter.test',
        password: 'Password123',
        firstName: 'Test',
        lastName: 'User',
      });

    expect(res.status).toBe(201);
    authToken = res.body.accessToken;
    userId = res.body.user.id;

    // 2. Register admin user & upgrade role in store
    const adminRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'super_admin',
        email: 'admin@globetrotter.test',
        password: 'AdminPassword123',
        firstName: 'Super',
        lastName: 'Admin',
      });

    adminUserId = adminRes.body.user.id;
    await repos.userRepo.update(adminUserId, { role: 'admin' });

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'super_admin',
        password: 'AdminPassword123',
      });

    adminToken = adminLogin.body.accessToken;
  });

  // Health Checks
  it('GET /health/live and GET /health/ready should return 200', async () => {
    const live = await request(app).get('/health/live');
    expect(live.status).toBe(200);
    expect(live.body.status).toBe('ok');

    const ready = await request(app).get('/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe('ready');
  });

  // Auth & Profile
  it('GET /api/v1/users/me should return authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('wanderer@globetrotter.test');
  });

  it('PATCH /api/v1/users/me should update profile while ignoring email/username mutations', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        firstName: 'UpdatedFirst',
        city: 'San Francisco',
        country: 'US',
      });

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('UpdatedFirst');
    expect(res.body.city).toBe('San Francisco');
  });

  // Catalog
  it('GET /api/v1/cities and GET /api/v1/activities should return seeded catalog items', async () => {
    const citiesRes = await request(app).get('/api/v1/cities');
    expect(citiesRes.status).toBe(200);
    expect(citiesRes.body.items.length).toBeGreaterThan(0);

    const firstCity = citiesRes.body.items[0];
    const singleCityRes = await request(app).get(`/api/v1/cities/${firstCity.id}`);
    expect(singleCityRes.status).toBe(200);
    expect(singleCityRes.body.name).toBe(firstCity.name);

    const actRes = await request(app).get('/api/v1/activities');
    expect(actRes.status).toBe(200);
    expect(actRes.body.items.length).toBeGreaterThan(0);
  });

  // Saved Destinations
  it('POST, GET, DELETE /api/v1/users/me/saved-destinations wishlist management', async () => {
    const cityId = '11111111-1111-1111-1111-111111111101'; // Paris

    const saveRes = await request(app)
      .post('/api/v1/users/me/saved-destinations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ cityId });
    expect(saveRes.status).toBe(201);

    const listRes = await request(app)
      .get('/api/v1/users/me/saved-destinations')
      .set('Authorization', `Bearer ${authToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items.some((c: { id: string }) => c.id === cityId)).toBe(true);

    const deleteRes = await request(app)
      .delete(`/api/v1/users/me/saved-destinations/${cityId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(deleteRes.status).toBe(204);
  });

  // Trips, Stops & Itinerary Lifecycle
  it('Full trip planning workflow: Create trip -> Add Stop -> Add Items -> Budget -> Share -> Copy', async () => {
    // 1. Create Trip
    const tripRes = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Summer Europe Grand Tour 2026',
        startDate: '2026-07-01',
        endDate: '2026-07-20',
        currencyCode: 'EUR',
      });

    expect(tripRes.status).toBe(201);
    const tripId = tripRes.body.id;
    expect(tripRes.body.status).toBe('draft');
    expect(tripRes.body.estimatedBudgetTotal).toBe('0.00');

    // 2. Add Stop 1 (Paris)
    const stop1Res = await request(app)
      .post(`/api/v1/trips/${tripId}/stops`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        cityId: '11111111-1111-1111-1111-111111111101',
        startDate: '2026-07-01',
        endDate: '2026-07-08',
        budgetAmount: '1200.00',
      });

    expect(stop1Res.status).toBe(201);
    const stop1Id = stop1Res.body.id;

    // 3. Add Stop 2 (Rome)
    const stop2Res = await request(app)
      .post(`/api/v1/trips/${tripId}/stops`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        cityId: '11111111-1111-1111-1111-111111111103',
        startDate: '2026-07-09',
        endDate: '2026-07-16',
        budgetAmount: '1000.00',
      });

    expect(stop2Res.status).toBe(201);
    const stop2Id = stop2Res.body.id;

    // 4. Reorder Stops
    const reorderRes = await request(app)
      .patch(`/api/v1/trips/${tripId}/stops/reorder`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orderedStopIds: [stop2Id, stop1Id],
      });
    expect(reorderRes.status).toBe(200);

    // 5. Add Itinerary Items to Stop 1
    const item1Res = await request(app)
      .post(`/api/v1/trip-stops/${stop1Id}/items`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        activityId: '22222222-2222-2222-2222-222222222201', // Eiffel Tower
        costCategory: 'activity',
        itemDate: '2026-07-02',
        cost: '70.00',
      });
    expect(item1Res.status).toBe(201);

    const item2Res = await request(app)
      .post(`/api/v1/trip-stops/${stop1Id}/items`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customName: 'Gourmet Dinner near Seine',
        costCategory: 'meal',
        itemDate: '2026-07-02',
        cost: '150.00',
      });
    expect(item2Res.status).toBe(201);

    // 6. Verify Trip Estimated Budget was automatically synced
    const tripDetail = await request(app)
      .get(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(tripDetail.status).toBe(200);
    expect(tripDetail.body.estimatedBudgetTotal).toBe('220.00');

    // 7. Get Budget Breakdown
    const budgetRes = await request(app)
      .get(`/api/v1/trips/${tripId}/budget`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(budgetRes.status).toBe(200);
    expect(budgetRes.body.totalActual).toBe('220.00');
    expect(budgetRes.body.byCategory.activity).toBe('70.00');
    expect(budgetRes.body.byCategory.meal).toBe('150.00');

    // 8. Get Full Itinerary
    const itineraryRes = await request(app)
      .get(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(itineraryRes.status).toBe(200);
    expect(itineraryRes.body.stops.length).toBe(2);

    // 9. Calendar query
    const calRes = await request(app)
      .get('/api/v1/trips/calendar?startMonth=2026-07-01&endMonth=2026-07-31')
      .set('Authorization', `Bearer ${authToken}`);
    expect(calRes.status).toBe(200);
    expect(calRes.body.entries.some((e: { tripId: string }) => e.tripId === tripId)).toBe(true);

    // 10. Public Sharing
    const shareRes = await request(app)
      .post(`/api/v1/trips/${tripId}/share`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(shareRes.status).toBe(200);
    expect(shareRes.body.isPublic).toBe(true);
    const shareToken = shareRes.body.shareToken;

    // 11. Public Read-Only View (Unauthenticated)
    const publicViewRes = await request(app).get(`/api/v1/public/trips/${shareToken}`);
    expect(publicViewRes.status).toBe(200);
    expect(publicViewRes.body.name).toBe('Summer Europe Grand Tour 2026');
    expect(publicViewRes.body.stops.length).toBe(2);

    // 12. Copy Trip (by another user)
    const copyRes = await request(app)
      .post(`/api/v1/public/trips/${shareToken}/copy`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(copyRes.status).toBe(201);
    expect(copyRes.body.name).toBe('Copy of Summer Europe Grand Tour 2026');
    expect(copyRes.body.id).not.toBe(tripId);
  });

  // Community Feed & Social Features
  it('Community posts, comments, and like/unlike idempotency', async () => {
    // 1. Create post
    const postRes = await request(app)
      .post('/api/v1/community/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'Just arrived in Tokyo! The neon lights in Shinjuku are mesmerizing.',
      });
    expect(postRes.status).toBe(201);
    const postId = postRes.body.id;

    // 2. Add comment
    const commentRes = await request(app)
      .post(`/api/v1/community/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Make sure to visit Omoide Yokocho!' });
    expect(commentRes.status).toBe(201);

    // 3. Like post
    const likeRes1 = await request(app)
      .post(`/api/v1/community/posts/${postId}/like`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(likeRes1.status).toBe(200);
    expect(likeRes1.body.liked).toBe(true);
    expect(likeRes1.body.likeCount).toBe(1);

    // 4. Double-like is idempotent
    const likeRes2 = await request(app)
      .post(`/api/v1/community/posts/${postId}/like`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(likeRes2.status).toBe(200);
    expect(likeRes2.body.likeCount).toBe(1);

    // 5. Feed listing
    const feedRes = await request(app).get('/api/v1/community/posts');
    expect(feedRes.status).toBe(200);
    expect(feedRes.body.items.some((p: { id: string }) => p.id === postId)).toBe(true);

    // 6. Unlike post
    const unlikeRes = await request(app)
      .delete(`/api/v1/community/posts/${postId}/like`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(unlikeRes.status).toBe(200);
    expect(unlikeRes.body.liked).toBe(false);
    expect(unlikeRes.body.likeCount).toBe(0);
  });

  // Admin & Analytics
  it('Admin endpoints: User listing, status change, and analytics', async () => {
    // Non-admin forbidden check
    const forbidRes = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${authToken}`);
    expect(forbidRes.status).toBe(403);

    // Admin user listing
    const adminUsersRes = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminUsersRes.status).toBe(200);
    expect(adminUsersRes.body.items.length).toBeGreaterThanOrEqual(2);

    // Admin analytics
    const popCities = await request(app)
      .get('/api/v1/admin/analytics/popular-cities')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(popCities.status).toBe(200);
    expect(popCities.body.items).toBeDefined();

    const trends = await request(app)
      .get('/api/v1/admin/analytics/trends')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(trends.status).toBe(200);
    expect(trends.body.totalTrips).toBeDefined();
  });

  // Media Pre-Signed URL
  it('POST /api/v1/media/upload-url generates pre-signed upload metadata', async () => {
    const res = await request(app)
      .post('/api/v1/media/upload-url')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        contentType: 'image/jpeg',
        purpose: 'profile',
      });

    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBeDefined();
    expect(res.body.objectUrl).toBeDefined();
  });
});
