import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACCOUNTS = [
  {
    email: 'admin@hazyeats.co.za',
    password: 'HazyAdmin#2026!',
    role: 'admin',
    name: 'ZikCode Administrator',
    phone: '013 737 8000',
    vehicle: '',
  },
  {
    email: 'buyer1@hazyeats.co.za',
    password: 'HazyBuyer#2026!',
    role: 'buyer',
    name: 'Thabo Mokoena',
    phone: '071 234 5678',
    vehicle: '',
  },
  {
    email: 'buyer2@hazyeats.co.za',
    password: 'HazyBuyer#2026!',
    role: 'buyer',
    name: 'Lindiwe Nkosi',
    phone: '082 411 9034',
    vehicle: '',
  },
  {
    email: 'driver1@hazyeats.co.za',
    password: 'HazyDriver#2026!',
    role: 'driver',
    name: 'Sipho Dlamini',
    phone: '072 987 6543',
    vehicle: 'Honda 125cc Bike - MP 442 GP',
  },
  {
    email: 'driver2@hazyeats.co.za',
    password: 'HazyDriver#2026!',
    role: 'driver',
    name: 'Mandla Mnisi',
    phone: '073 552 1904',
    vehicle: 'VW Polo Vivo - MP 509 GP',
  },
  {
    email: 'kfc.owner@hazyeats.co.za',
    password: 'HazyStore#2026!',
    role: 'store',
    name: 'Nomsa Sibeko',
    phone: '076 410 2201',
    vehicle: '',
  },
  {
    email: 'chickenlicken.owner@hazyeats.co.za',
    password: 'HazyStore#2026!',
    role: 'store',
    name: 'Kagiso Mahlangu',
    phone: '076 410 2202',
    vehicle: '',
  },
  {
    email: 'zakheles.owner@hazyeats.co.za',
    password: 'HazyStore#2026!',
    role: 'store',
    name: 'Zakhele Sithole',
    phone: '076 410 2203',
    vehicle: '',
  },
];

// Exact stores, item names, and prices from HazyyyyEatss.html, organized cleanly by group and size
const STORES_SEED = [
  {
    slug: 'kfc',
    name: 'KFC',
    category: 'Fast food',
    delivery_time: '30–45 min',
    is_community: false,
    ownerEmail: 'kfc.owner@hazyeats.co.za',
    logo_url: 'https://thumb.wikimedia.org/wikipedia/sco/thumb/b/bf/KFC_logo.svg/3840px-KFC_logo.svg.png?utm_source=sco.wikipedia.org&utm_campaign=index&utm_content=thumbnail',
    menu: [
      { name: 'Streetwise 2 with Chips', price: 46.90, item_group: 'main', sort_order: 1 },
      { name: 'Streetwise 3 with Pap/Chips', price: 62.90, item_group: 'main', sort_order: 2 },
      { name: 'Zinger Wings (10 pcs)', price: 79.90, item_group: 'main', sort_order: 3 },
      { name: '9 Piece Family Treat Bucket', price: 189.90, item_group: 'main', sort_order: 4 },
    ],
  },
  {
    slug: 'debonairs',
    name: 'Debonairs Pizza',
    category: 'Pizza',
    delivery_time: '35–50 min',
    is_community: false,
    logo_url: 'https://play-lh.googleusercontent.com/YEEX7Yr2rUJehodZI9I8a-UPG8aWLF3btcN0fKsSGh87bCu3qVaFW_VPVDK1CvkgU56TLqYqtuW7ndoaza589Q',
    menu: [
      { name: 'Medium Chicken & Mushroom', price: 99.90, item_group: 'main', sort_order: 1 },
      { name: 'Large Something Meaty Pizza', price: 149.90, item_group: 'main', sort_order: 2 },
      { name: 'Large Crammed-Crust Triple-Decker', price: 189.90, item_group: 'main', sort_order: 3 },
    ],
  },
  {
    slug: 'mcdonalds',
    name: "McDonald's",
    category: 'Fast food',
    delivery_time: '30–45 min',
    is_community: false,
    logo_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4b/McDonald%27s_logo.svg/3840px-McDonald%27s_logo.svg.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail',
    menu: [
      { name: 'Big Mac Medium Meal', price: 84.90, item_group: 'main', sort_order: 1 },
      { name: 'McFeast Spicy Meal', price: 96.90, item_group: 'main', sort_order: 2 },
      { name: '20 Chicken McNuggets Sharebox', price: 114.90, item_group: 'main', sort_order: 3 },
    ],
  },
  {
    slug: 'romans',
    name: "Roman's Pizza",
    category: 'Pizza',
    delivery_time: '35–50 min',
    is_community: false,
    logo_url: 'https://play-lh.googleusercontent.com/eC59UkNel1D2TEYZEBdJHTEhAe_bt4i-U2tYRJ6Aq8UDpgNtO6iFb-QTfHZ6MnEEgcAbWR1ZJ63HvQD-ab6V',
    menu: [
      { name: 'Large Double Cheese & Pepperoni', price: 129.90, item_group: 'main', sort_order: 1 },
      { name: 'Large Chicken Mayo Pizza', price: 134.90, item_group: 'main', sort_order: 2 },
    ],
  },
  {
    slug: 'spur',
    name: 'Spur',
    category: 'Restaurant',
    delivery_time: '40–55 min',
    is_community: false,
    logo_url: 'https://spurcorporation.com/wp-content/uploads/2024/02/Spur-Transparent.png',
    menu: [
      { name: 'Cheddamelt Schnitzel & Chips', price: 139.90, item_group: 'main', sort_order: 1 },
      { name: '400g Full Rack Pork Ribs', price: 219.90, item_group: 'main', sort_order: 2 },
    ],
  },
  {
    slug: 'steers',
    name: 'Steers',
    category: 'Fast food',
    delivery_time: '30–45 min',
    is_community: false,
    logo_url: 'https://cavendish.co.za/wp-content/uploads/Steers.jpg',
    menu: [
      { name: 'Wacky Wednesday 2 Burgers Deal', price: 69.90, item_group: 'main', sort_order: 1 },
      { name: 'King Steer Burger & Medium Chips', price: 94.90, item_group: 'main', sort_order: 2 },
    ],
  },
  {
    slug: 'chickenlicken',
    name: 'Chicken Licken',
    category: 'Fast food',
    delivery_time: '30–45 min',
    is_community: false,
    ownerEmail: 'chickenlicken.owner@hazyeats.co.za',
    logo_url: 'https://chickenlicken.co.za/images/CL-small-logo.svg',
    menu: [
      { name: 'Big John Burger Meal', price: 54.00, item_group: 'main', sort_order: 1 },
      { name: 'Hotwings Max 8 pcs & Soul Fries', price: 78.00, item_group: 'main', sort_order: 2 },
      { name: 'Soul Sister Party 6 pcs', price: 95.00, item_group: 'main', sort_order: 3 },
    ],
  },
  {
    slug: 'burgerking',
    name: 'Burger King',
    category: 'Fast food',
    delivery_time: '30–45 min',
    is_community: false,
    logo_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4b/Burger_King_logo_%281999%E2%80%932020%29.svg/1280px-Burger_King_logo_%281999%E2%80%932020%29.svg.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail',
    menu: [
      { name: 'Whopper Medium Meal', price: 89.90, item_group: 'main', sort_order: 1 },
      { name: 'Big King XXL Meal', price: 109.90, item_group: 'main', sort_order: 2 },
    ],
  },
  {
    slug: 'spar',
    name: 'Spar Hazyview',
    category: 'Groceries',
    delivery_time: '40–55 min',
    is_community: false,
    logo_url: 'https://thespargroup.com/wp-content/uploads/photo-gallery/SPAR_Vertical_Logo.jpeg?bwg=1544795791',
    menu: [
      { name: 'Full Rotisserie Grilled Chicken', price: 94.90, item_group: 'main', sort_order: 1 },
      { name: 'Spar Famous Large Hot Slap Chips', price: 32.00, item_group: 'side', sort_order: 2 },
      { name: '2L Coca-Cola + Fresh Bread Bundle', price: 44.00, item_group: 'drink', sort_order: 3 },
    ],
  },
  {
    slug: 'wimpy',
    name: 'Wimpy',
    category: 'Fast food',
    delivery_time: '35–50 min',
    is_community: false,
    logo_url: 'https://wimpy.co.za/site/images/svg-elements/wimpy-logo-red.svg',
    menu: [
      { name: 'Champion Breakfast & Filter Coffee', price: 79.90, item_group: 'main', sort_order: 1 },
      { name: 'Double Cheese Burger & Chips', price: 92.90, item_group: 'main', sort_order: 2 },
    ],
  },
  {
    slug: 'woolworths',
    name: 'Woolworths Food',
    category: 'Groceries',
    delivery_time: '40–60 min',
    is_community: false,
    logo_url: 'https://1000logos.net/wp-content/uploads/2018/07/Woolworths-Logo.jpg',
    menu: [
      { name: 'Butter Chicken & Basmati Rice Meal', price: 89.90, item_group: 'main', sort_order: 1 },
      { name: 'Chuckle Milk 1L + Belgian Chocolate', price: 74.90, item_group: 'drink', sort_order: 2 },
    ],
  },
  {
    slug: 'oceanbasket',
    name: 'Ocean Basket',
    category: 'Restaurant',
    delivery_time: '40–55 min',
    is_community: false,
    logo_url: 'https://www.oceanbasket.com/wp-content/uploads/2022/09/square-logo.png',
    menu: [
      { name: 'Famous Fish & Chips (Hake)', price: 99.00, item_group: 'main', sort_order: 1 },
      { name: 'Platter for 1 (Prawns, Hake, Calamari)', price: 165.00, item_group: 'main', sort_order: 2 },
    ],
  },
  {
    slug: 'pioneers',
    name: 'Pioneers Grill',
    category: 'Restaurant',
    delivery_time: '35–50 min',
    is_community: false,
    logo_url: '',
    menu: [
      { name: 'Peri-Peri Half Chicken & Chips', price: 115.00, item_group: 'main', sort_order: 1 },
      { name: '300g Flame-Grilled Rump Steak', price: 155.00, item_group: 'main', sort_order: 2 },
    ],
  },
  {
    slug: 'kuka',
    name: 'Kuka Cafe',
    category: 'Restaurant',
    delivery_time: '35–50 min',
    is_community: false,
    logo_url: '',
    menu: [
      { name: 'Creamy Chicken Pasta', price: 110.00, item_group: 'main', sort_order: 1 },
      { name: 'Gourmet Wagyu Burger & Wedges', price: 125.00, item_group: 'main', sort_order: 2 },
    ],
  },
  {
    slug: 'zakheles',
    name: "Zakhele's Kota & Chips",
    category: 'Community',
    delivery_time: '25–40 min',
    is_community: true,
    ownerEmail: 'zakheles.owner@hazyeats.co.za',
    logo_url: '',
    menu: [
      { name: 'Classic Kota (Polony, Cheese, Chips, Atchar)', price: 25.00, item_group: 'main', sort_order: 1 },
      { name: 'Special Kota (Russian, Egg, Cheese, Chips)', price: 35.00, item_group: 'main', sort_order: 2 },
      { name: 'Full House King Kota (Beef Patty, Russian, Cheese)', price: 45.00, item_group: 'main', sort_order: 3 },
      { name: 'Small Slap Chips', price: 25.00, item_group: 'side', sort_order: 4 },
      { name: 'Medium Slap Chips', price: 35.00, item_group: 'side', sort_order: 5 },
      { name: 'Large Slap Chips', price: 45.00, item_group: 'side', sort_order: 6 },
      { name: '330ml Soft Drink Can', price: 15.00, item_group: 'drink', sort_order: 7 },
    ],
  },
  {
    slug: 'mamazodwa',
    name: "Mama Zodwa's Kitchen",
    category: 'Community',
    delivery_time: '25–40 min',
    is_community: true,
    logo_url: '',
    menu: [
      { name: 'Kasi Fries & Russian Plate', price: 35.00, item_group: 'main', sort_order: 1 },
      { name: 'Mama Zodwa Loaded Kota', price: 40.00, item_group: 'main', sort_order: 2 },
      { name: 'Pap & Grilled Beef + Chakalaka Plate', price: 55.00, item_group: 'main', sort_order: 3 },
      { name: 'Rice, Pork & Chicken Mixture Plate', price: 65.00, item_group: 'main', sort_order: 4 },
      { name: '2L Assorted Soft Drink', price: 28.00, item_group: 'drink', sort_order: 5 },
    ],
  },
];

async function ensureUser(acct) {
  const { data: listed } = await supabase.auth.admin.listUsers({ perPage: 200 });
  const existing = listed?.users?.find((u) => u.email?.toLowerCase() === acct.email.toLowerCase());
  let userId = existing?.id;

  if (!userId) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: acct.email,
      password: acct.password,
      email_confirm: true,
      user_metadata: {
        name: acct.name,
        phone: acct.phone,
        role: acct.role === 'admin' ? 'buyer' : acct.role,
        vehicle: acct.vehicle,
      },
    });
    if (error) throw error;
    userId = created.user.id;
  }

  // Upsert profile directly with service role so admin role & fields are exact
  const { error: profErr } = await supabase.from('profiles').upsert({
    id: userId,
    role: acct.role,
    name: acct.name,
    phone: acct.phone,
    vehicle: acct.vehicle,
    is_online: acct.role === 'driver',
    is_active: true,
    needs_onboarding: false,
  });
  if (profErr) throw profErr;

  return userId;
}

async function seedStoresAndMenus(userIdsByEmail) {
  const storeRowsBySlug = {};

  for (const s of STORES_SEED) {
    const ownerId = s.ownerEmail ? userIdsByEmail[s.ownerEmail] ?? null : null;
    const { data: existingStore } = await supabase
      .from('stores')
      .select('id')
      .eq('name', s.name)
      .maybeSingle();

    let storeId = existingStore?.id;
    if (!storeId) {
      const { data: inserted, error } = await supabase
        .from('stores')
        .insert({
          slug: s.slug,
          owner_id: ownerId,
          name: s.name,
          category: s.category,
          delivery_time: s.delivery_time,
          is_community: s.is_community,
          logo_url: s.logo_url,
          is_open: true,
          is_approved: true,
        })
        .select('id')
        .single();
      if (error) throw error;
      storeId = inserted.id;
    } else if (ownerId) {
      await supabase
        .from('stores')
        .update({ owner_id: ownerId, is_approved: true })
        .eq('id', storeId);
    }

    const { data: existingItems } = await supabase
      .from('menu_items')
      .select('id, name')
      .eq('store_id', storeId);

    const existingNames = new Set((existingItems || []).map((i) => i.name));
    const missingItems = s.menu
      .filter((item) => !existingNames.has(item.name))
      .map((item) => ({
        store_id: storeId,
        name: item.name,
        price: item.price,
        item_group: item.item_group,
        is_available: true,
        sort_order: item.sort_order,
      }));

    if (missingItems.length > 0) {
      const { error: itemErr } = await supabase.from('menu_items').insert(missingItems);
      if (itemErr) throw itemErr;
    }

    const { data: menuList } = await supabase
      .from('menu_items')
      .select('id, name, price, item_group')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true });

    storeRowsBySlug[s.slug] = { id: storeId, name: s.name, menu: menuList || [] };
  }

  return storeRowsBySlug;
}

async function seedHistoricalOrders(userIdsByEmail, storeRowsBySlug) {
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .like('code', 'ORD-H%');

  if ((count ?? 0) >= 30) {
    console.log('Historical orders already seeded.');
    return;
  }

  const buyers = [
    { id: userIdsByEmail['buyer1@hazyeats.co.za'], phone: '071 234 5678' },
    { id: userIdsByEmail['buyer2@hazyeats.co.za'], phone: '082 411 9034' },
  ];
  const drivers = [
    userIdsByEmail['driver1@hazyeats.co.za'],
    userIdsByEmail['driver2@hazyeats.co.za'],
  ];
  const addresses = [
    'House 114, Shabalala Trust, Hazyview',
    'Stand 287, Shabalala Near Primary School',
    'Plot 42, Hazyview Junction Rd',
    'House 603, Shabalala Extension 2',
    'Stand 88, Mkhuhlu View, Shabalala',
  ];

  const storeKeys = Object.keys(storeRowsBySlug);

  for (let i = 1; i <= 30; i++) {
    const code = `ORD-H${String(i).padStart(3, '0')}`;
    const { data: exists } = await supabase
      .from('orders')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (exists) continue;

    const daysAgo = (i % 14) + 1;
    const deliveredAt = new Date(Date.now() - daysAgo * 86400_000 - (i % 9) * 3600_000);
    const createdAt = new Date(deliveredAt.getTime() - 42 * 60_000);
    const pickedUpAt = new Date(deliveredAt.getTime() - 18 * 60_000);

    const storeA = storeRowsBySlug[storeKeys[i % storeKeys.length]];
    const storeB = i % 2 === 0 ? storeRowsBySlug[storeKeys[(i + 5) % storeKeys.length]] : null;

    const pickedStores = storeB && storeB.id !== storeA.id ? [storeA, storeB] : [storeA];
    const itemsToInsert = [];
    let subtotal = 0;

    for (const st of pickedStores) {
      const mainItem = st.menu.find((m) => m.item_group === 'main') || st.menu[0];
      if (!mainItem) continue;
      const qty = (i % 2) + 1;
      subtotal += Number(mainItem.price) * qty;
      itemsToInsert.push({
        store_id: st.id,
        menu_item_id: mainItem.id,
        name: mainItem.name,
        price: mainItem.price,
        item_group: mainItem.item_group,
        qty,
      });
    }

    const deliveryFee = 20;
    const total = subtotal + deliveryFee;
    const buyer = buyers[i % buyers.length];
    const driverId = drivers[i % drivers.length];

    const { data: insertedOrder, error: ordErr } = await supabase
      .from('orders')
      .insert({
        code,
        buyer_id: buyer.id,
        buyer_phone: buyer.phone,
        address: addresses[i % addresses.length],
        notes: i % 3 === 0 ? 'Call at the silver gate' : '',
        subtotal,
        delivery_fee: deliveryFee,
        total,
        status: 'delivered',
        driver_id: driverId,
        created_at: createdAt.toISOString(),
        updated_at: deliveredAt.toISOString(),
        picked_up_at: pickedUpAt.toISOString(),
        delivered_at: deliveredAt.toISOString(),
      })
      .select('id')
      .single();

    if (ordErr) throw ordErr;

    const orderItemsRows = itemsToInsert.map((item) => ({
      ...item,
      order_id: insertedOrder.id,
    }));
    const { error: oiErr } = await supabase.from('order_items').insert(orderItemsRows);
    if (oiErr) throw oiErr;

    const partsRows = pickedStores.map((st) => ({
      order_id: insertedOrder.id,
      store_id: st.id,
      status: 'ready',
      accepted_at: new Date(createdAt.getTime() + 4 * 60_000).toISOString(),
      ready_at: new Date(createdAt.getTime() + 20 * 60_000).toISOString(),
      created_at: createdAt.toISOString(),
    }));
    const { error: partErr } = await supabase.from('order_store_parts').insert(partsRows);
    if (partErr) throw partErr;
  }
}

async function main() {
  console.log('Seeding HazyEats Supabase accounts...');
  const userIdsByEmail = {};
  for (const acct of ACCOUNTS) {
    userIdsByEmail[acct.email] = await ensureUser(acct);
  }

  console.log('Seeding 16 stores and exact menus...');
  const storeRowsBySlug = await seedStoresAndMenus(userIdsByEmail);

  console.log('Seeding 30 completed historical orders...');
  await seedHistoricalOrders(userIdsByEmail, storeRowsBySlug);

  console.log('HazyEats seed completed successfully.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
