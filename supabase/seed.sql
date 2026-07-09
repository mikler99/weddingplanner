-- =============================================================================
-- Seed — Michael & Olivia McCann, Quayle's Brewery, Sept 25 2027.
-- Numbers are from the real venue contract + Northbound quote; match exactly.
-- Runs as the service role (RLS bypassed), so no membership needed to seed.
-- Fixed wedding_id lets you re-run against a clean DB deterministically.
-- =============================================================================
\set wid '11111111-1111-1111-1111-111111111111'

insert into weddings (id, name, event_date, venue_name, venue_address, guest_estimate, guest_guarantee)
values (:'wid', 'Michael & Olivia',
        '2027-09-25',
        'Quayle''s Brewery — The Hilltop (ceremony) + The Nursery (reception)',
        '4567 Line 12 N, Oro-Medonte, ON L0K 1E0',
        80, 70);

-- Budget config -------------------------------------------------------------
insert into budget_config (wedding_id, bar_rate, tableware_pp, delivery, rentals, saved, monthly)
values (:'wid', 55, 2, 250, 200, 0, 0);

-- Venue & bar (subtotal 9100 = 6500 + 2100 + 500) ---------------------------
insert into venue_costs (wedding_id, label, amount, sort) values
  (:'wid', 'The Nursery (reception)', 6500, 0),
  (:'wid', 'The Hilltop (ceremony)',  2100, 1),
  (:'wid', 'Landmark fee',             500, 2);

-- Caterers — Northbound BBQ drop-off; Triple Tailgate selected --------------
insert into caterers (wedding_id, name, package, price_pp, is_selected, sort) values
  (:'wid', 'Northbound BBQ', 'Double Tailgate (2 meats, 2 sides)', 45, false, 0),
  (:'wid', 'Northbound BBQ', 'Triple Tailgate (3 meats, 2 sides)', 50, true,  1),
  (:'wid', 'Northbound BBQ', 'Quad Tailgate (4 meats, 2 sides)',   60, false, 2),
  (:'wid', null,             null,                                   0, false, 3);  -- competing quote

-- Everything-else budget lines ----------------------------------------------
insert into budget_lines (wedding_id, label, amount, sort) values
  (:'wid', 'Event insurance',                283,  0),
  (:'wid', 'Special Occasion Permit',         50,  1),
  (:'wid', 'Florals (DIY baby''s breath)',  1200,  2),
  (:'wid', 'Photography',                   1500,  3),
  (:'wid', 'DJ/MC (friends)',                  0,  4),
  (:'wid', 'Officiant (friend)',               0,  5),
  (:'wid', 'Cake/dessert',                   600,  6),
  (:'wid', 'Attire',                        3000,  7),
  (:'wid', 'Hair & makeup',                  800,  8),
  (:'wid', 'Stationery (e-invites)',           0,  9),
  (:'wid', 'Contingency',                   1000, 10);

-- Payments — Quayle's, beer/wine option (full bar = 4273.75 each).
-- due_date left null on purpose: real dates arrive when the contract is
-- imported (extraction deposit_schedule) and stay human-editable on Apply.
insert into payments (wedding_id, label, due_date, amount, sort) values
  (:'wid', '25% deposit — due at signing', null, 4011.75, 0),
  (:'wid', '25% installment — Sep 2026',   null, 4011.75, 1),
  (:'wid', '25% installment — Mar 2027',   null, 4011.75, 2),
  (:'wid', '25% final — Jul 2027',         null, 4011.75, 3);

-- Milestones ----------------------------------------------------------------
insert into milestones (wedding_id, when_label, task, owner, sort) values
  (:'wid', 'Now', 'Confirm Sept 25 availability with Quayle''s (contract listed Sept 11 & 18 only)', 'Couple', 0),
  (:'wid', 'Now', 'Decide bar package + sign contract + pay 25% deposit', 'Couple', 1),
  (:'wid', 'Now', 'Send Quayle''s the drop-off / trash / 18%-service questions', 'Michael', 2),
  (:'wid', 'Now', 'Confirm Northbound insurance, license & delivery fee', 'Michael', 3),
  (:'wid', 'Aug–Sep 2026', 'Book photographer (books up 12+ months out)', 'Couple', 4),
  (:'wid', 'Aug–Sep 2026', 'Send save-the-dates via the invite site', 'Michael', 5),
  (:'wid', 'Sep 2026', 'Pay 2nd venue installment', 'Couple', 6),
  (:'wid', 'Sep–Oct 2026', 'Finalize guest list + collect addresses', 'Couple', 7),
  (:'wid', 'Oct–Dec 2026', 'Lock friends for DJ / MC / officiant', 'Couple', 8),
  (:'wid', 'Oct–Dec 2026', 'Start attire shopping + alterations', 'Couple', 9),
  (:'wid', 'Oct–Dec 2026', 'Decide florals approach (DIY baby''s breath?)', 'Couple', 10),
  (:'wid', 'Jan–Mar 2027', 'Book cake/dessert (confirm Quayle''s pre-approval)', 'Couple', 11),
  (:'wid', 'Jan–Mar 2027', 'Menu tasting / finalize BBQ selections', 'Couple', 12),
  (:'wid', 'Mar 2027', 'Pay 3rd venue installment', 'Couple', 13),
  (:'wid', 'Mar–Apr 2027', 'Send invitations + activate RSVP site', 'Michael', 14),
  (:'wid', 'Apr–Jun 2027', 'Reserve rentals (chafers, sternos, linens)', 'Couple', 15),
  (:'wid', 'Apr–Jun 2027', 'Book hair & makeup + trial', 'Couple', 16),
  (:'wid', 'Apr–Jun 2027', 'Plan day-of timeline + assign teardown/trash owner', 'Couple', 17),
  (:'wid', 'Jul 2027 (30 days)', 'Pay final installment + give final guest count', 'Couple', 18),
  (:'wid', 'Jul 2027 (30 days)', 'Apply for Special Occasion Permit + wine/spirit picks', 'Michael', 19),
  (:'wid', 'Sep 2027 (10 days)', 'Bind event insurance; name Quayle''s as additional insured', 'Michael', 20),
  (:'wid', 'Sep 2027 (10 days)', 'Send caterer Cert. of Insurance + license to Quayle''s', 'Michael', 21),
  (:'wid', 'Sep 2027 (2 wks)', 'Logistics/setup meeting with Quayle''s', 'Couple', 22),
  (:'wid', 'Sep 25, 2027', 'WEDDING DAY', '—', 23);

-- Vendors -------------------------------------------------------------------
insert into vendors (wedding_id, category, name, quote, status, next_step, sort) values
  (:'wid', 'Venue',       'Quayle''s Brewery', 16047, 'Tentative', 'Confirm Sept 25 + sign/deposit', 0),
  (:'wid', 'Catering',    'Northbound BBQ',        0, 'Quoting',   'Delivery fee + insurance/license', 1),
  (:'wid', 'Photography', null,                    0, 'Open',      null, 2),
  (:'wid', 'Florals',     null,                    0, 'Open',      null, 3),
  (:'wid', 'Insurance',   'PAL Canada',          283, 'Open',      null, 4);

-- Documents (urls blank) ----------------------------------------------------
insert into documents (wedding_id, label, sort) values
  (:'wid', 'Quayle''s contract',       0),
  (:'wid', 'Northbound menu',          1),
  (:'wid', 'Digital invitation site',  2),
  (:'wid', 'Budget spreadsheet',       3);

-- ---------------------------------------------------------------------------
-- Link the couple once they've signed up (run manually, service role).
-- Membership is NOT self-service via RLS — do it here or in a Server Action.
--   insert into wedding_members (wedding_id, user_id, role) values
--     ('11111111-1111-1111-1111-111111111111', '<michael-auth-uid>', 'owner'),
--     ('11111111-1111-1111-1111-111111111111', '<olivia-auth-uid>',  'owner');
--   update weddings set created_by = '<michael-auth-uid>' where id = '11111111-1111-1111-1111-111111111111';
-- ---------------------------------------------------------------------------
