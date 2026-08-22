-- Migration 0016: Production Seed Reference Data
-- Idempotent starter catalog with 20 major global destination cities and curated activities

-- 16.1 Starter Global Cities (>= 20 major destinations)
INSERT INTO cities (id, name, country, country_code, region, cost_index, popularity_score, latitude, longitude, description)
VALUES
    ('a0000001-0000-0000-0000-000000000001', 'Paris', 'France', 'FR', 'Western Europe', 85.50, 98, 48.856614, 2.352222, 'The City of Light, famous for romance, art, and cuisine.'),
    ('a0000001-0000-0000-0000-000000000002', 'Tokyo', 'Japan', 'JP', 'East Asia', 82.00, 99, 35.676192, 139.650311, 'Ultra-modern metropolis blended with timeless historic temples.'),
    ('a0000001-0000-0000-0000-000000000003', 'New York City', 'United States', 'US', 'North America', 100.00, 97, 40.712776, -74.005974, 'The premier global hub for culture, theater, dining, and skyline architecture.'),
    ('a0000001-0000-0000-0000-000000000004', 'Rome', 'Italy', 'IT', 'Southern Europe', 74.20, 95, 41.902782, 12.496366, 'The Eternal City, home of the Colosseum and historic Vatican City.'),
    ('a0000001-0000-0000-0000-000000000005', 'London', 'United Kingdom', 'GB', 'Western Europe', 92.40, 96, 51.507351, -0.127758, 'Historic capital on the Thames rich in royalty, museums, and theater.'),
    ('a0000001-0000-0000-0000-000000000006', 'Barcelona', 'Spain', 'ES', 'Southern Europe', 68.90, 92, 41.385064, 2.173404, 'Famous for Gaudí architecture, Mediterranean beaches, and tapas culture.'),
    ('a0000001-0000-0000-0000-000000000007', 'Bangkok', 'Thailand', 'TH', 'Southeast Asia', 45.30, 91, 13.756331, 100.501765, 'Vibrant street life, ornate shrines, and culinary excellence.'),
    ('a0000001-0000-0000-0000-000000000008', 'Sydney', 'Australia', 'AU', 'Oceania', 84.10, 88, -33.868820, 151.209296, 'Harbor city famous for the Sydney Opera House and Bondi Beach.'),
    ('a0000001-0000-0000-0000-000000000009', 'Cape Town', 'South Africa', 'ZA', 'Southern Africa', 48.70, 86, -33.924869, 18.424055, 'Coastal gem crowned by Table Mountain and Cape Point vineyards.'),
    ('a0000001-0000-0000-0000-000000000010', 'Dubai', 'United Arab Emirates', 'AE', 'Middle East', 88.00, 90, 25.204849, 55.270783, 'Modern luxury destination known for Burj Khalifa and desert safaris.'),
    ('a0000001-0000-0000-0000-000000000011', 'Singapore', 'Singapore', 'SG', 'Southeast Asia', 89.50, 89, 1.352083, 103.819836, 'Futuristic garden city renowned for Marina Bay and hawker markets.'),
    ('a0000001-0000-0000-0000-000000000012', 'Amsterdam', 'Netherlands', 'NL', 'Western Europe', 81.30, 89, 52.367573, 4.904138, 'Charming canals, world-class cycling, and Van Gogh artistry.'),
    ('a0000001-0000-0000-0000-000000000013', 'Cairo', 'Egypt', 'EG', 'North Africa', 35.80, 84, 30.044420, 31.235712, 'Historic home of the Giza Pyramids and ancient Nile treasures.'),
    ('a0000001-0000-0000-0000-000000000014', 'Rio de Janeiro', 'Brazil', 'BR', 'South America', 52.00, 85, -22.906847, -43.172896, 'Famous for Christ the Redeemer, Copacabana, and vibrant samba.'),
    ('a0000001-0000-0000-0000-000000000015', 'Seoul', 'South Korea', 'KR', 'East Asia', 76.50, 93, 37.566535, 126.977969, 'High-tech trendsetter with K-culture, royal palaces, and night markets.'),
    ('a0000001-0000-0000-0000-000000000016', 'Istanbul', 'Turkey', 'TR', 'Eurasia', 46.20, 91, 41.008238, 28.978359, 'Historic crossroads of Europe and Asia across the Bosphorus strait.'),
    ('a0000001-0000-0000-0000-000000000017', 'Buenos Aires', 'Argentina', 'AR', 'South America', 44.10, 82, -34.603722, -58.381593, 'The Paris of South America, known for tango, steak, and vibrant barrios.'),
    ('a0000001-0000-0000-0000-000000000018', 'Berlin', 'Germany', 'DE', 'Western Europe', 72.40, 87, 52.520007, 13.404954, 'Renowned for contemporary history, creative arts, and nightlife.'),
    ('a0000001-0000-0000-0000-000000000019', 'San Francisco', 'United States', 'US', 'North America', 98.60, 86, 37.774929, -122.419416, 'Iconic Golden Gate Bridge, cable cars, and Pacific bay views.'),
    ('a0000001-0000-0000-0000-000000000020', 'Kyoto', 'Japan', 'JP', 'East Asia', 71.00, 94, 35.011636, 135.768029, 'Ancient imperial capital famous for serene bamboo groves and shrines.')
ON CONFLICT (name, country_code) DO NOTHING;

-- 16.2 Curated Activities for Seeded Cities
INSERT INTO activities (city_id, name, description, category, cost_estimate, currency_code, duration_minutes, popularity_score)
VALUES
    -- Paris
    ('a0000001-0000-0000-0000-000000000001', 'Eiffel Tower Summit Access', 'Elevator ticket to the top observatory of the Eiffel Tower.', 'sightseeing', 35.00, 'EUR', 120, 99),
    ('a0000001-0000-0000-0000-000000000001', 'Louvre Museum Guided Tour', 'Skip-the-line guided masterpiece tour including Mona Lisa.', 'culture', 65.00, 'EUR', 180, 98),
    ('a0000001-0000-0000-0000-000000000001', 'Seine River Dinner Cruise', 'Romantic evening cruise with 3-course French dining.', 'food', 110.00, 'EUR', 150, 92),
    -- Tokyo
    ('a0000001-0000-0000-0000-000000000002', 'teamLab Planets Digital Art Museum', 'Immersive body-interactive digital art exhibition in Toyosu.', 'culture', 30.00, 'USD', 120, 97),
    ('a0000001-0000-0000-0000-000000000002', 'Tsukiji Outer Market Food Tour', 'Taste fresh sushi, tamagoyaki, and street seafood.', 'food', 55.00, 'USD', 180, 94),
    ('a0000001-0000-0000-0000-000000000002', 'Shibuya Crossing & Sky Observatory', 'View the world-famous scramble crossing from 229m high.', 'sightseeing', 18.00, 'USD', 90, 96),
    -- New York City
    ('a0000001-0000-0000-0000-000000000003', 'Broadway Musical Tickets', 'Orchestra seating for an award-winning Broadway production.', 'culture', 145.00, 'USD', 160, 96),
    ('a0000001-0000-0000-0000-000000000003', 'Statue of Liberty & Ellis Island Ferry', 'Round-trip ferry with grounds access to Lady Liberty.', 'sightseeing', 25.00, 'USD', 240, 93),
    ('a0000001-0000-0000-0000-000000000003', 'Central Park Guided Bicycle Tour', 'Scenic 2-hour bike ride through historic Central Park landmarks.', 'adventure', 40.00, 'USD', 120, 89),
    -- Rome
    ('a0000001-0000-0000-0000-000000000004', 'Colosseum & Roman Forum Tour', 'Priority entrance and gladiator arena floor guided experience.', 'culture', 58.00, 'EUR', 180, 97),
    ('a0000001-0000-0000-0000-000000000004', 'Vatican Museums & Sistine Chapel', 'Skip-the-line entrance to Michelangelo’s masterpieces.', 'culture', 45.00, 'EUR', 210, 98),
    ('a0000001-0000-0000-0000-000000000004', 'Trastevere Evening Food & Wine Tasting', 'Stroll through medieval alleys tasting pasta, cheeses, and prosecco.', 'food', 75.00, 'EUR', 180, 91),
    -- London
    ('a0000001-0000-0000-0000-000000000005', 'Tower of London & Crown Jewels', 'Explore royal history and view the glittering Crown Jewels.', 'culture', 38.00, 'GBP', 150, 94),
    ('a0000001-0000-0000-0000-000000000005', 'London Eye Standard Experience', 'Iconic 30-minute flight in a glass observation capsule.', 'sightseeing', 34.00, 'GBP', 45, 92),
    ('a0000001-0000-0000-0000-000000000005', 'West End Afternoon Tea & Theatre Tour', 'Traditional British afternoon tea combined with a historic theatre walk.', 'food', 60.00, 'GBP', 120, 88),
    -- Barcelona
    ('a0000001-0000-0000-0000-000000000006', 'Sagrada Familia Fast-Track & Towers', 'Guided tour of Antoni Gaudí’s unmissable basilica and tower views.', 'culture', 42.00, 'EUR', 120, 98),
    ('a0000001-0000-0000-0000-000000000006', 'Park Güell Monumental Zone Access', 'Stroll through the iconic mosaic salamander and panoramic vistas.', 'sightseeing', 14.00, 'EUR', 90, 95),
    ('a0000001-0000-0000-0000-000000000006', 'Gothic Quarter Tapas & Wine Tour', 'Taste authentic Iberian ham, patatas bravas, and regional wines.', 'food', 65.00, 'EUR', 180, 93)
ON CONFLICT DO NOTHING;

-- 16.3 Designated Administrator Seed Account
INSERT INTO users (
    id, username, email, password_hash, first_name, last_name, phone_number, city, country,
    additional_info, role, status, has_verified_email, notification_preferences
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin1234',
    'admin1234@temporaryaccount.none',
    '$argon2id$v=19$m=65536,t=3,p=4$vU0o1Gz92bJvH7C10H2jKg$Z5i1r7HjH0FjW4Zq4lKk1jG0t3vX4bV1yU9w2kP4mQo',
    'GlobeTrotter',
    'Admin',
    '+19999999999',
    'Admin HQ',
    'Global',
    'Primary System Administrator for GlobeTrotter',
    'admin',
    'active',
    true,
    '{"email": true, "push": true, "inApp": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET role = 'admin', status = 'active';


