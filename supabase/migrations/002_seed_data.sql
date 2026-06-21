-- ═══════════════════════════════════════════════════════════════════════════
-- prime-atlas · Seed Data — Costa Blanca, Alicante & Valencia
-- Migration 002 — Run after 001_initial_schema.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── MUNICIPALITIES ───────────────────────────────────────────────────────────

INSERT INTO municipalities (name, region, country, population, growth_metrics, growth_score, infrastructure_score, development_score, liquidity_score, risk_score, opportunity_score, lat, lng)
VALUES
  -- Costa Blanca
  ('Torrevieja',       'Costa Blanca', 'Spain', 105000,
   '{"population_growth_pct": 3.2, "tourism_index": 78, "migration_net": 1200}',
   78, 71, 82, 85, 28, 87, 37.9781, -0.6825),

  ('Orihuela Costa',   'Costa Blanca', 'Spain', 72000,
   '{"population_growth_pct": 4.1, "tourism_index": 82, "migration_net": 1800}',
   82, 68, 79, 81, 32, 84, 37.8891, -0.7421),

  ('L''Alfàs del Pi',  'Costa Blanca', 'Spain', 21000,
   '{"population_growth_pct": 5.3, "employment_growth_pct": 2.8, "migration_net": 900}',
   85, 80, 77, 74, 25, 83, 38.5841, 0.0591),

  ('Benidorm',         'Costa Blanca', 'Spain', 73000,
   '{"population_growth_pct": 1.8, "tourism_index": 95, "migration_net": 600}',
   72, 85, 70, 90, 30, 82, 38.5370, -0.1319),

  ('Calpe',            'Costa Blanca', 'Spain', 29000,
   '{"population_growth_pct": 3.8, "tourism_index": 76, "migration_net": 750}',
   79, 74, 75, 78, 27, 81, 38.6450, 0.0447),

  ('Dénia',            'Costa Blanca', 'Spain', 44000,
   '{"population_growth_pct": 2.9, "tourism_index": 80, "employment_growth_pct": 1.9}',
   74, 78, 73, 80, 29, 80, 38.8414, 0.1060),

  ('Guardamar del Segura', 'Costa Blanca', 'Spain', 16500,
   '{"population_growth_pct": 4.5, "migration_net": 620}',
   83, 65, 80, 71, 26, 79, 38.0926, -0.6570),

  ('Santa Pola',       'Costa Blanca', 'Spain', 35000,
   '{"population_growth_pct": 3.1, "tourism_index": 68, "migration_net": 540}',
   76, 70, 74, 75, 31, 77, 38.1886, -0.5582),

  -- Alicante
  ('Alicante',         'Alicante',     'Spain', 335000,
   '{"population_growth_pct": 1.4, "gdp_growth_pct": 3.1, "employment_growth_pct": 2.4}',
   65, 88, 72, 88, 35, 79, 38.3452, -0.4810),

  ('San Vicente del Raspeig', 'Alicante', 'Spain', 58000,
   '{"population_growth_pct": 2.2, "gdp_growth_pct": 3.8, "employment_growth_pct": 3.1}',
   71, 76, 78, 72, 28, 78, 38.3942, -0.5241),

  ('El Campello',      'Alicante',     'Spain', 29000,
   '{"population_growth_pct": 3.4, "tourism_index": 65, "migration_net": 480}',
   77, 72, 76, 73, 27, 77, 38.4369, -0.3946),

  ('Mutxamel',         'Alicante',     'Spain', 24000,
   '{"population_growth_pct": 3.9, "employment_growth_pct": 2.7}',
   80, 70, 80, 68, 24, 77, 38.4199, -0.4699),

  -- Valencia Region
  ('Sagunto',          'Valencia',     'Spain', 66000,
   '{"population_growth_pct": 2.8, "gdp_growth_pct": 5.2, "employment_growth_pct": 4.1}',
   73, 82, 84, 70, 38, 79, 39.6810, -0.2722),

  ('Gandia',           'Valencia',     'Spain', 75000,
   '{"population_growth_pct": 1.9, "tourism_index": 72, "employment_growth_pct": 2.1}',
   68, 76, 71, 76, 32, 76, 38.9682, -0.1823),

  ('Paterna',          'Valencia',     'Spain', 70000,
   '{"population_growth_pct": 3.6, "gdp_growth_pct": 4.8, "employment_growth_pct": 3.9}',
   79, 80, 82, 74, 30, 79, 39.5030, -0.4385),

  ('Burjassot',        'Valencia',     'Spain', 37000,
   '{"population_growth_pct": 1.5, "gdp_growth_pct": 3.4}',
   62, 78, 70, 72, 33, 73, 39.5090, -0.4102),

  ('Torrent',          'Valencia',     'Spain', 83000,
   '{"population_growth_pct": 2.1, "gdp_growth_pct": 3.9, "employment_growth_pct": 2.8}',
   70, 79, 74, 75, 31, 76, 39.4337, -0.4672),

  ('Alzira',           'Valencia',     'Spain', 44000,
   '{"population_growth_pct": 1.8, "gdp_growth_pct": 2.9}',
   64, 72, 69, 68, 34, 71, 39.1510, -0.4340);

-- ─── INFRASTRUCTURE PROJECTS ──────────────────────────────────────────────────

INSERT INTO infrastructure_projects (project_name, type, budget, status, impact_score, municipality_id, expected_completion, description)
SELECT
  'N-332 Dual Carriageway Extension', 'road', 18500000000, 'approved', 82,
  id, '2027-06-30',
  'Expansion of the N-332 coastal highway to dual carriageway between Torrevieja and Orihuela Costa, reducing transit times by 40% and opening 1,200 ha of development land.'
FROM municipalities WHERE name = 'Torrevieja';

INSERT INTO infrastructure_projects (project_name, type, budget, status, impact_score, municipality_id, expected_completion, description)
SELECT
  'TRAM Alicante Line 3 Extension', 'rail', 95000000000, 'approved', 91,
  id, '2028-12-31',
  'Extension of the Alicante TRAM network to El Campello and beyond, connecting 3 municipalities and an estimated 45,000 daily commuters to the city centre.'
FROM municipalities WHERE name = 'Alicante';

INSERT INTO infrastructure_projects (project_name, type, budget, status, impact_score, municipality_id, expected_completion, description)
SELECT
  'Sagunto Industrial Port Expansion', 'port', 220000000000, 'under_construction', 88,
  id, '2026-12-31',
  'Major expansion of Sagunto industrial port with 3 new deepwater berths. Part of the Mediterranean Corridor logistics hub. Estimated 4,000 new jobs.'
FROM municipalities WHERE name = 'Sagunto';

INSERT INTO infrastructure_projects (project_name, type, budget, status, impact_score, municipality_id, expected_completion, description)
SELECT
  'Dénia Fast Ferry Terminal Upgrade', 'port', 12000000000, 'approved', 74,
  id, '2027-03-31',
  'Modernisation of Dénia port ferry terminal, increasing Balearic Islands passenger capacity by 60%. Direct impact on tourism and second-home demand.'
FROM municipalities WHERE name = 'Dénia';

INSERT INTO infrastructure_projects (project_name, type, budget, status, impact_score, municipality_id, expected_completion, description)
SELECT
  'Paterna Technology Park Phase 2', 'commercial', 85000000000, 'under_construction', 85,
  id, '2027-09-30',
  'Second phase of Valencia''s leading tech park adds 120,000 m² of Grade-A office and R&D space. 35 companies already pre-committed, 2,800 new high-value jobs.'
FROM municipalities WHERE name = 'Paterna';

-- ─── SIGNALS ─────────────────────────────────────────────────────────────────

INSERT INTO signals (signal_type, title, summary, source, source_url, confidence_level, opportunity_impact, municipality_id, detected_at)
SELECT
  'infrastructure_approved',
  'N-332 Dual Carriageway Approved by Ministerio de Transportes',
  'The Spanish Ministry of Transport has given final approval to the N-332 dual carriageway expansion between Torrevieja and Orihuela Costa. Construction to begin Q3 2025. Historically, road infrastructure approvals of this scale drive +15–25% in residential land values within 5km of the route within 24 months.',
  'Boletín Oficial del Estado', 'https://www.boe.es',
  0.95, 88,
  id, NOW() - INTERVAL '2 days'
FROM municipalities WHERE name = 'Torrevieja';

INSERT INTO signals (signal_type, title, summary, source, source_url, confidence_level, opportunity_impact, municipality_id, detected_at)
SELECT
  'employer_relocating',
  'Amazon Logistics Hub Confirmed — Sagunto Free Zone',
  'Amazon has confirmed a 180,000 m² logistics hub in the Sagunto Free Zone, creating an estimated 1,200 direct jobs. Operation expected from Q2 2026. Residential demand within 15km historically spikes 18–30% within 12 months of announcements of this scale.',
  'Expansion.com', 'https://www.expansion.com',
  0.92, 91,
  id, NOW() - INTERVAL '1 day'
FROM municipalities WHERE name = 'Sagunto';

INSERT INTO signals (signal_type, title, summary, source, source_url, confidence_level, opportunity_impact, municipality_id, detected_at)
SELECT
  'transport_link',
  'TRAM Line 3 Extension EIS Published — Final Planning Stage',
  'The Environmental Impact Study for the TRAM Line 3 extension from Alicante to El Campello has been published, marking the last planning milestone before construction. EIS approval historically takes 3–6 months. Areas within 500m of new stations show 12–20% uplift on approval.',
  'GVA Infraestructures', 'https://www.gva.es',
  0.88, 85,
  id, NOW() - INTERVAL '3 days'
FROM municipalities WHERE name = 'El Campello';

INSERT INTO signals (signal_type, title, summary, source, source_url, confidence_level, opportunity_impact, municipality_id, detected_at)
SELECT
  'development_zone',
  'L''Alfàs del Pi New Development Zone — 450 ha Approved',
  'The Alicante provincial planning authority has approved a new 450 hectare mixed-use development zone in L''Alfàs del Pi, including 3,200 residential units, a hotel zone, and commercial parcels. First planning applications expected Q4 2025.',
  'Diputación Provincial de Alicante', NULL,
  0.90, 87,
  id, NOW() - INTERVAL '5 days'
FROM municipalities WHERE name = 'L''Alfàs del Pi';

INSERT INTO signals (signal_type, title, summary, source, source_url, confidence_level, opportunity_impact, municipality_id, detected_at)
SELECT
  'government_investment',
  'Paterna Tech Park Phase 2 — €85M Regional Investment Confirmed',
  'The Valencia regional government has confirmed €85M in direct investment for Phase 2 of the Paterna Technology Park. The announcement follows pre-commitment agreements with 35 technology firms. This cements Paterna as the primary tech employment hub for the Valencia metro area.',
  'Generalitat Valenciana', 'https://www.gva.es',
  0.94, 89,
  id, NOW() - INTERVAL '1 day'
FROM municipalities WHERE name = 'Paterna';

-- ─── OPPORTUNITIES ────────────────────────────────────────────────────────────

INSERT INTO opportunities (title, investment_thesis, opportunity_score, risk_level, risk_score, municipality_id, category, evidence, scores, status)
SELECT
  'Torrevieja Coastal Residential — Pre-Infrastructure Play',
  'Torrevieja is entering a high-conviction infrastructure catalyst window. The approved N-332 dual carriageway (scheduled Q3 2025) will reduce drive times to Alicante by 35 minutes and unlock 1,200 ha of developable coastal land. Northern European retirement migration continues at 3.2% YoY population growth. Current land prices remain 30–45% below equivalent Costa del Sol assets with comparable access scores. Entry thesis: acquire residential plots within 3km of the N-332 alignment before construction commencement. 18–36 month hold, target 25–40% uplift at completion.',
  87, 'low', 28,
  id, 'Coastal',
  '[
    {"source": "BOE", "date": "2025-01-15", "summary": "N-332 expansion final approval published", "confidence": 0.95},
    {"source": "INE", "date": "2024-12-01", "summary": "Torrevieja population +3.2% YoY, highest in Alicante province", "confidence": 0.98},
    {"source": "Tinsa", "date": "2025-02-01", "summary": "Coastal land price index: Torrevieja -32% vs Costa del Sol", "confidence": 0.85}
  ]',
  '{"growth_score": 78, "infrastructure_score": 71, "development_score": 82, "liquidity_score": 85, "risk_score": 28, "opportunity_score": 87}',
  'active'
FROM municipalities WHERE name = 'Torrevieja';

INSERT INTO opportunities (title, investment_thesis, opportunity_score, risk_level, risk_score, municipality_id, category, evidence, scores, status)
SELECT
  'Sagunto Industrial Land — Mediterranean Corridor Beneficiary',
  'Sagunto is the single highest-conviction logistics and industrial play in Eastern Spain. The Mediterranean Rail Corridor (operational 2026), Sagunto Port expansion (under construction), and the Amazon confirmation create a compounding catalyst stack rarely seen in a single municipality. Industrial land adjacent to the free zone trades at €45–85/m² vs €180–250/m² in Valencia city equivalents. The Amazon announcement alone typically reprices surrounding industrial land by 25–40% within 12 months (Valencia precedents: Amazon Ribarroja 2019 +31%, XPO Logistics Almussafes 2021 +27%). Entry thesis: industrial plots 1–5km from Free Zone boundary. 12–24 month hold minimum.',
  91, 'low', 38,
  id, 'Industrial',
  '[
    {"source": "Ministerio de Transportes", "date": "2025-01-10", "summary": "Mediterranean Corridor Valencia-Sagunto completion confirmed Q2 2026", "confidence": 0.96},
    {"source": "Expansion.com", "date": "2025-06-18", "summary": "Amazon 180,000m² logistics hub confirmed, 1,200 jobs", "confidence": 0.92},
    {"source": "Zona Franca Sagunto", "date": "2025-03-01", "summary": "Port Phase 2 under construction, completion Q4 2026", "confidence": 0.94}
  ]',
  '{"growth_score": 73, "infrastructure_score": 82, "development_score": 84, "liquidity_score": 70, "risk_score": 38, "opportunity_score": 91}',
  'active'
FROM municipalities WHERE name = 'Sagunto';

INSERT INTO opportunities (title, investment_thesis, opportunity_score, risk_level, risk_score, municipality_id, category, evidence, scores, status)
SELECT
  'L''Alfàs del Pi New Development Zone — First-Mover Residential',
  'The approval of a 450ha mixed-use development zone in L''Alfàs del Pi creates a rare greenfield opportunity in a municipality with the strongest net migration rate in the Costa Blanca Norte (+5.3% YoY). The zone includes 3,200 consented residential units — only 12% currently under contract. First-mover acquisition of consented plots before developer competition intensifies (typically 18–24 months post-approval) offers 35–55% potential uplift to planning-ready status. L''Alfàs benefits from TRAM connectivity to Benidorm (2km) and Alicante (40km by road), making it structurally different to isolated development plays.',
  83, 'low', 25,
  id, 'Infrastructure',
  '[
    {"source": "Diputación Alicante", "date": "2025-01-20", "summary": "450ha development zone approved, 3,200 units consented", "confidence": 0.90},
    {"source": "INE", "date": "2024-12-01", "summary": "L''Alfàs del Pi net migration +5.3% — highest Costa Blanca Norte", "confidence": 0.98},
    {"source": "Idealista", "date": "2025-05-01", "summary": "Asking prices +9% YoY, inventory down 22%", "confidence": 0.80}
  ]',
  '{"growth_score": 85, "infrastructure_score": 80, "development_score": 77, "liquidity_score": 74, "risk_score": 25, "opportunity_score": 83}',
  'active'
FROM municipalities WHERE name = 'L''Alfàs del Pi';

INSERT INTO opportunities (title, investment_thesis, opportunity_score, risk_level, risk_score, municipality_id, category, evidence, scores, status)
SELECT
  'Paterna Tech Corridor — Residential Undersupply Play',
  'Paterna is Valencia''s fastest-growing employment hub and has the most acute residential undersupply relative to job creation in the region. The Tech Park Phase 2 announcement adds 2,800 high-income jobs to a municipality currently producing fewer than 400 new residential units per year. This demand-supply imbalance, combined with direct metro access to Valencia (15 mins), points to 20–35% rental yield compression and capital growth over 24–36 months. Comparable tech-hub residential plays (San Cugat/Barcelona, Alcobendas/Madrid) delivered 28–42% over 3 years post-campus announcement. Thesis: BTR (Build-to-Rent) blocks or multi-unit residential within 1km of the Park.',
  79, 'low', 30,
  id, 'Infrastructure',
  '[
    {"source": "Generalitat Valenciana", "date": "2025-06-19", "summary": "€85M Phase 2 investment confirmed, 35 pre-committed companies", "confidence": 0.94},
    {"source": "Fotocasa", "date": "2025-04-01", "summary": "Paterna rental vacancy rate 1.2% — lowest in Valencia metro", "confidence": 0.87},
    {"source": "INE", "date": "2024-12-01", "summary": "Paterna employment growth +3.9% YoY", "confidence": 0.98}
  ]',
  '{"growth_score": 79, "infrastructure_score": 80, "development_score": 82, "liquidity_score": 74, "risk_score": 30, "opportunity_score": 79}',
  'active'
FROM municipalities WHERE name = 'Paterna';

-- ─── PLANNING APPLICATIONS ────────────────────────────────────────────────────

INSERT INTO planning_applications (project_type, status, municipality_id, application_date, description, applicant)
SELECT 'residential', 'approved', id, '2025-01-08',
  '285-unit residential complex, coastal zone, 3 blocks × 6 floors', 'Metrovacesa SA'
FROM municipalities WHERE name = 'Torrevieja';

INSERT INTO planning_applications (project_type, status, municipality_id, application_date, description, applicant)
SELECT 'industrial', 'approved', id, '2025-02-14',
  '45,000m² logistics warehouse — Phase 1 Amazon pre-let', 'Prologis Europe'
FROM municipalities WHERE name = 'Sagunto';

INSERT INTO planning_applications (project_type, status, municipality_id, application_date, description, applicant)
SELECT 'commercial', 'pending', id, '2025-05-20',
  '18,000m² mixed-use retail and office ground floor, residential above', 'Local developer'
FROM municipalities WHERE name = 'L''Alfàs del Pi';

INSERT INTO planning_applications (project_type, status, municipality_id, application_date, description)
SELECT 'commercial', 'approved', id, '2025-03-01',
  '15,000m² Grade-A office building — Paterna Tech Park Phase 2 Plot A'
FROM municipalities WHERE name = 'Paterna';

COMMIT;
