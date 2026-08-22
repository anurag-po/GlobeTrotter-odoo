/**
 * GlobeTrotter — Admin Panel & Places/Activities Management Module
 */
import { AuthService } from './auth.js';
import { UIService } from './ui.js';

export const AdminModule = {
  defaultPlaces: [
    { id: 'place-1', name: 'Paris', country: 'France', region: 'Europe', avgCost: '18,500', satisfaction: '94.2%', visits: '14,820', description: 'The City of Light, famous for romance, art, and world-class cuisine.' },
    { id: 'place-2', name: 'Tokyo', country: 'Japan', region: 'East Asia', avgCost: '22,000', satisfaction: '96.8%', visits: '11,450', description: 'Ultra-modern metropolis blended with timeless historic shrines.' },
    { id: 'place-3', name: 'New York City', country: 'USA', region: 'North America', avgCost: '28,000', satisfaction: '91.5%', visits: '9,380', description: 'Premier global hub for culture, theater, dining, and skyline views.' },
    { id: 'place-4', name: 'Rome', country: 'Italy', region: 'Europe', avgCost: '16,200', satisfaction: '93.4%', visits: '8,720', description: 'The Eternal City, home of the Colosseum and historic ruins.' },
    { id: 'place-5', name: 'Jaipur & Udaipur', country: 'India', region: 'Rajasthan', avgCost: '12,500', satisfaction: '97.2%', visits: '16,400', description: 'Royal palace heritage circuits, historic forts, and pristine lake boat tours.' },
  ],

  defaultActivities: [
    { id: 'act-1', name: 'Eiffel Tower Summit Tour', place: 'Paris', category: 'Sightseeing', cost: '3,200', duration: '2.5 hrs', description: 'Ascent to the top observatory of the Eiffel Tower with panoramic views.' },
    { id: 'act-2', name: 'Shibuya Crossing & Ramen Walk', place: 'Tokyo', category: 'Food & Culture', cost: '4,500', duration: '3 hrs', description: 'Guided street food and ramen tasting through neon Shibuya alleys.' },
    { id: 'act-3', name: 'Lake Pichola Sunset Boat Cruise', place: 'Jaipur & Udaipur', category: 'Heritage', cost: '1,800', duration: '1.5 hrs', description: 'Private scenic boat ride around Jag Mandir and City Palace.' },
    { id: 'act-4', name: 'Colosseum Gladiator Arena Access', place: 'Rome', category: 'Culture', cost: '3,800', duration: '3 hrs', description: 'Exclusive floor access with archaeologist historian guide.' },
  ],

  getPlaces() {
    try {
      const stored = localStorage.getItem('gt_admin_places');
      return stored ? JSON.parse(stored) : this.defaultPlaces;
    } catch {
      return this.defaultPlaces;
    }
  },

  savePlaces(places) {
    localStorage.setItem('gt_admin_places', JSON.stringify(places));
  },

  getActivities() {
    try {
      const stored = localStorage.getItem('gt_admin_activities');
      return stored ? JSON.parse(stored) : this.defaultActivities;
    } catch {
      return this.defaultActivities;
    }
  },

  saveActivities(activities) {
    localStorage.setItem('gt_admin_activities', JSON.stringify(activities));
  },

  init() {
    const tabs = document.querySelectorAll('.admin-tabs__tab');
    const contents = document.querySelectorAll('.admin-content');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        contents.forEach((c) => c.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(tab.dataset.tab);
        if (target) target.classList.add('active');
      });
    });

    if (document.getElementById('chart-users')) {
      this.drawPieChart('chart-users');
    }

    this.renderPlacesList();
    this.renderActivitiesList();
  },

  renderPlacesList() {
    const container = document.getElementById('chart-cities');
    if (!container) return;

    const places = this.getPlaces();

    let listHtml = places
      .map(
        (p, idx) => `
        <li style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: var(--clr-bg); border-radius: var(--radius-sm); border: 1px solid var(--clr-border); margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <span style="font-weight: 800; color: var(--clr-primary); font-size: 1.1rem; width: 26px;">#${idx + 1}</span>
            <div>
              <div style="font-weight: 700; font-size: 1rem; color: var(--clr-text);">${p.name}, ${p.country}</div>
              <div style="font-size: 0.82rem; color: var(--clr-text-muted); margin-top: 2px;">
                ${p.region} &bull; Avg. Cost: <strong>₹${p.avgCost}</strong> &bull; ${p.description || ''}
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <button type="button" class="btn btn--sm" style="background: #FEE2E2; color: #DC2626; padding: 6px 12px; font-weight: 700; border-radius: 6px;" onclick="window.AdminModule.removePlace('${p.id}')">
              <i class="fas fa-trash-alt"></i> Remove
            </button>
          </div>
        </li>
      `
      )
      .join('');

    container.innerHTML = `
      <div style="width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--clr-border); flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--clr-text);">Destination Catalog (${places.length} Places)</h3>
            <p style="font-size: 0.82rem; color: var(--clr-text-muted);">Manage global destinations, regional pricing, and traveler recommendations.</p>
          </div>
          <button type="button" class="btn btn--primary btn--sm" style="font-weight: 700;" onclick="window.AdminModule.openAddPlaceModal()">
            <i class="fas fa-plus"></i> Add Place
          </button>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0;">
          ${listHtml || '<li style="color: var(--clr-text-muted); padding: 20px; text-align: center;">No destinations in catalog. Click "+ Add Place" to add one.</li>'}
        </ul>
      </div>
    `;
  },

  renderActivitiesList() {
    const container = document.getElementById('chart-activities');
    if (!container) return;

    const activities = this.getActivities();

    let listHtml = activities
      .map(
        (a, idx) => `
        <li style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: var(--clr-bg); border-radius: var(--radius-sm); border: 1px solid var(--clr-border); margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <span style="font-weight: 800; color: var(--clr-accent); font-size: 1.1rem; width: 26px;">#${idx + 1}</span>
            <div>
              <div style="font-weight: 700; font-size: 1rem; color: var(--clr-text);">${a.name}</div>
              <div style="font-size: 0.82rem; color: var(--clr-text-muted); margin-top: 2px;">
                <span class="badge" style="background: var(--clr-primary-light); color: var(--clr-primary); font-size: 0.72rem; padding: 2px 6px;">${a.category}</span> &bull; 
                Place: <strong>${a.place}</strong> &bull; Price: <strong>₹${a.cost}</strong> &bull; Duration: ${a.duration}
              </div>
            </div>
          </div>
          <button type="button" class="btn btn--sm" style="background: #FEE2E2; color: #DC2626; padding: 6px 12px; font-weight: 700; border-radius: 6px;" onclick="window.AdminModule.removeActivity('${a.id}')">
            <i class="fas fa-trash-alt"></i> Remove
          </button>
        </li>
      `
      )
      .join('');

    container.innerHTML = `
      <div style="width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--clr-border); flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--clr-text);">Curated Activities Catalog (${activities.length} Items)</h3>
            <p style="font-size: 0.82rem; color: var(--clr-text-muted);">Manage bookable excursions, tickets, tours, and price details.</p>
          </div>
          <button type="button" class="btn btn--primary btn--sm" style="font-weight: 700;" onclick="window.AdminModule.openAddActivityModal()">
            <i class="fas fa-plus"></i> Add Activity
          </button>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0;">
          ${listHtml || '<li style="color: var(--clr-text-muted); padding: 20px; text-align: center;">No activities in catalog. Click "+ Add Activity" to add one.</li>'}
        </ul>
      </div>
    `;
  },

  addPlace(place) {
    const places = this.getPlaces();
    const newPlace = {
      id: 'place-' + Date.now(),
      ...place,
    };
    places.unshift(newPlace);
    this.savePlaces(places);
    this.renderPlacesList();
    UIService.showToast(`Destination "${place.name}" added to catalog!`, 'success');
  },

  removePlace(id) {
    let places = this.getPlaces();
    const target = places.find((p) => p.id === id);
    places = places.filter((p) => p.id !== id);
    this.savePlaces(places);
    this.renderPlacesList();
    UIService.showToast(`Destination "${target?.name || 'Place'}" removed.`, 'info');
  },

  addActivity(activity) {
    const activities = this.getActivities();
    const newActivity = {
      id: 'act-' + Date.now(),
      ...activity,
    };
    activities.unshift(newActivity);
    this.saveActivities(activities);
    this.renderActivitiesList();
    UIService.showToast(`Activity "${activity.name}" added!`, 'success');
  },

  removeActivity(id) {
    let activities = this.getActivities();
    const target = activities.find((a) => a.id === id);
    activities = activities.filter((a) => a.id !== id);
    this.saveActivities(activities);
    this.renderActivitiesList();
    UIService.showToast(`Activity "${target?.name || 'Item'}" removed.`, 'info');
  },

  openAddPlaceModal() {
    let modal = document.getElementById('adminAddPlaceModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'adminAddPlaceModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-card" style="max-width: 500px;">
          <div class="modal-header">
            <h3>Add New Place / Destination</h3>
            <button type="button" class="modal-close" onclick="document.getElementById('adminAddPlaceModal').classList.remove('active')">&times;</button>
          </div>
          <form id="adminPlaceForm" onsubmit="window.handleAdminAddPlace(event)">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">City / Destination Name *</label>
                <input type="text" id="admPlaceName" class="form-control" placeholder="e.g. Manali" required>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label class="form-label">Country *</label>
                  <input type="text" id="admPlaceCountry" class="form-control" placeholder="India" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Region / State *</label>
                  <input type="text" id="admPlaceRegion" class="form-control" placeholder="Himachal Pradesh" required>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Average Cost (₹) *</label>
                <input type="number" id="admPlaceCost" class="form-control" placeholder="8500" required>
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="admPlaceDesc" class="form-control" rows="2" placeholder="Brief destination overview and highlight attractions..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn--outline" onclick="document.getElementById('adminAddPlaceModal').classList.remove('active')">Cancel</button>
              <button type="submit" class="btn btn--primary">Save Destination</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.classList.add('active');
  },

  openAddActivityModal() {
    let modal = document.getElementById('adminAddActModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'adminAddActModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-card" style="max-width: 500px;">
          <div class="modal-header">
            <h3>Add New Curated Activity</h3>
            <button type="button" class="modal-close" onclick="document.getElementById('adminAddActModal').classList.remove('active')">&times;</button>
          </div>
          <form id="adminActForm" onsubmit="window.handleAdminAddActivity(event)">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Activity Name *</label>
                <input type="text" id="admActName" class="form-control" placeholder="e.g. Paragliding Tandem Flight" required>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label class="form-label">Destination / Place *</label>
                  <input type="text" id="admActPlace" class="form-control" placeholder="Manali" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Category *</label>
                  <select id="admActCategory" class="form-control" required>
                    <option value="Adventure">Adventure</option>
                    <option value="Sightseeing">Sightseeing</option>
                    <option value="Heritage">Heritage</option>
                    <option value="Food & Culture">Food & Culture</option>
                    <option value="Relaxation">Relaxation</option>
                  </select>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label class="form-label">Cost / Price (₹) *</label>
                  <input type="number" id="admActCost" class="form-control" placeholder="3200" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Duration</label>
                  <input type="text" id="admActDuration" class="form-control" placeholder="2 hours">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="admActDesc" class="form-control" rows="2" placeholder="Activity details, safety instructions, or inclusions..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn--outline" onclick="document.getElementById('adminAddActModal').classList.remove('active')">Cancel</button>
              <button type="submit" class="btn btn--primary">Save Activity</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.classList.add('active');
  },

  drawPieChart(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <svg viewBox="0 0 200 200" width="200" height="200">
        <circle cx="100" cy="100" r="90" fill="#1A56DB" />
        <path d="M100,100 L100,10 A90,90 0 0,1 190,100 Z" fill="#FF5A5F" />
        <path d="M100,100 L190,100 A90,90 0 0,1 145,185 Z" fill="#10B981" />
        <path d="M100,100 L145,185 A90,90 0 0,1 55,185 Z" fill="#F59E0B" />
        <circle cx="100" cy="100" r="45" fill="white" />
        <text x="100" y="105" text-anchor="middle" font-size="13" font-weight="800" fill="#0F172A">Users</text>
      </svg>
    `;
  },
};

// Global form submission handlers
window.handleAdminAddPlace = function (e) {
  e.preventDefault();
  const name = document.getElementById('admPlaceName').value.trim();
  const country = document.getElementById('admPlaceCountry').value.trim();
  const region = document.getElementById('admPlaceRegion').value.trim();
  const avgCost = document.getElementById('admPlaceCost').value.trim();
  const description = document.getElementById('admPlaceDesc').value.trim();

  AdminModule.addPlace({ name, country, region, avgCost, description });
  document.getElementById('adminAddPlaceModal').classList.remove('active');
  document.getElementById('adminPlaceForm').reset();
};

window.handleAdminAddActivity = function (e) {
  e.preventDefault();
  const name = document.getElementById('admActName').value.trim();
  const place = document.getElementById('admActPlace').value.trim();
  const category = document.getElementById('admActCategory').value;
  const cost = document.getElementById('admActCost').value.trim();
  const duration = document.getElementById('admActDuration').value.trim() || '1.5 hrs';
  const description = document.getElementById('admActDesc').value.trim();

  AdminModule.addActivity({ name, place, category, cost, duration, description });
  document.getElementById('adminAddActModal').classList.remove('active');
  document.getElementById('adminActForm').reset();
};
