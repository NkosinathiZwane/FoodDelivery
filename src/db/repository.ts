import crypto from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  driverApplicationDocuments,
  driverApplications,
  menuItems,
  orderItems,
  orderMessages,
  orders,
  orderStoreStatuses,
  stores,
  users,
} from './schema.ts';
import { ensureSeeded } from './seed.ts';
import {
  FLAT_DELIVERY_FEE_CENTS,
  ORDER_STATUS,
  canUserMessageOrder,
  computeStatusAfterStoreReady,
} from '../utils/orders.ts';
import type {
  AdminOverviewDTO,
  DriverApplicationDTO,
  DriverApplicationStatus,
  DriverOnboardingPayload,
  OrderDTO,
  OrderMessageDTO,
  PaymentMethod,
  PaymentStatus,
  StoreDTO,
  StorePrepStatus,
  UserProfile,
  UserRole,
} from '../types.ts';

interface StoresCacheEntry {
  data: StoreDTO[];
  etag: string;
  expiresAt: number;
}

let storesCache: StoresCacheEntry | null = null;
const STORES_CACHE_TTL_MS = 30_000;

export function invalidateStoresCache(): void {
  storesCache = null;
}

function toUserProfile(row: typeof users.$inferSelect): UserProfile {
  return {
    id: row.id,
    uid: row.uid,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: row.role as UserRole,
    vehicle: row.vehicle,
    storeName: row.storeName,
    authProvider: (row.authProvider === 'google' ? 'google' : 'local') as 'local' | 'google',
  };
}

export async function getUserWithPasswordByEmail(email: string) {
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getUserWithPasswordByEmail:', error);
    throw new Error('Failed to retrieve user record.', { cause: error });
  }
}

export async function getUserByUid(uid: string): Promise<UserProfile | null> {
  try {
    await ensureSeeded();
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] ? toUserProfile(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Failed to retrieve user profile.', { cause: error });
  }
}

export async function createLocalUser(input: {
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  vehicle: string;
  storeName: string;
  passwordHash: string;
}): Promise<UserProfile> {
  try {
    await ensureSeeded();
    const uid = `local:${crypto.randomUUID()}`;
    const [inserted] = await db
      .insert(users)
      .values({
        uid,
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
        phone: input.phone.trim(),
        role: input.role,
        vehicle: input.vehicle.trim(),
        storeName: input.storeName.trim(),
        passwordHash: input.passwordHash,
        authProvider: 'local',
      })
      .returning();
    return toUserProfile(inserted);
  } catch (error) {
    console.error('Database query failed in createLocalUser:', error);
    throw new Error('Could not create user account.', { cause: error });
  }
}

export async function upsertGoogleUser(input: {
  uid: string;
  email: string;
  name: string;
  role?: UserRole;
  phone?: string;
  vehicle?: string;
  storeName?: string;
}): Promise<UserProfile> {
  try {
    await ensureSeeded();
    const normalizedEmail = input.email.trim().toLowerCase();
    const existingByUid = await db
      .select()
      .from(users)
      .where(eq(users.uid, input.uid))
      .limit(1);

    if (existingByUid[0]) {
      const [updated] = await db
        .update(users)
        .set({
          email: normalizedEmail,
          name: input.name || existingByUid[0].name,
        })
        .where(eq(users.id, existingByUid[0].id))
        .returning();
      return toUserProfile(updated);
    }

    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingByEmail[0]) {
      const [linked] = await db
        .update(users)
        .set({
          uid: input.uid,
          authProvider: 'google',
          name: input.name || existingByEmail[0].name,
        })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();
      return toUserProfile(linked);
    }

    const safeRole: UserRole =
      input.role && ['buyer', 'driver', 'store'].includes(input.role)
        ? input.role
        : 'buyer';

    const [created] = await db
      .insert(users)
      .values({
        uid: input.uid,
        email: normalizedEmail,
        name: input.name || normalizedEmail.split('@')[0],
        phone: input.phone?.trim() || 'Verified via Google',
        role: safeRole,
        vehicle: input.vehicle?.trim() || '',
        storeName: input.storeName?.trim() || '',
        passwordHash: null,
        authProvider: 'google',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email: normalizedEmail },
      })
      .returning();

    return toUserProfile(created);
  } catch (error) {
    console.error('Database query failed in upsertGoogleUser:', error);
    throw new Error('Failed to synchronize Google account.', { cause: error });
  }
}

export async function getStoresWithMenusCached(): Promise<{
  stores: StoreDTO[];
  etag: string;
}> {
  const now = Date.now();
  if (storesCache && storesCache.expiresAt > now) {
    return { stores: storesCache.data, etag: storesCache.etag };
  }

  try {
    await ensureSeeded();
    const [storeRows, menuRows] = await Promise.all([
      db.select().from(stores).orderBy(stores.createdAt, stores.name),
      db.select().from(menuItems).where(eq(menuItems.available, true)).orderBy(menuItems.name),
    ]);

    const menuMap = new Map<string, StoreDTO['menu']>();
    for (const m of menuRows) {
      const arr = menuMap.get(m.storeId) ?? [];
      arr.push({
        id: m.id,
        storeId: m.storeId,
        name: m.name,
        priceCents: m.priceCents,
        price: Number((m.priceCents / 100).toFixed(2)),
        available: m.available,
      });
      menuMap.set(m.storeId, arr);
    }

    const result: StoreDTO[] = storeRows.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      time: s.deliveryTime,
      isCommunity: s.isCommunity,
      logo: s.logoUrl,
      menu: menuMap.get(s.id) ?? [],
    }));

    const etag = `"stores-${crypto
      .createHash('sha1')
      .update(JSON.stringify(result))
      .digest('hex')
      .slice(0, 16)}"`;

    storesCache = {
      data: result,
      etag,
      expiresAt: now + STORES_CACHE_TTL_MS,
    };

    return { stores: result, etag };
  } catch (error) {
    console.error('Database query failed in getStoresWithMenusCached:', error);
    throw new Error('Failed to load stores from database.', { cause: error });
  }
}

export async function createVendorStore(input: {
  name: string;
  category: string;
  dishName: string;
  priceCents: number;
}): Promise<StoreDTO> {
  try {
    await ensureSeeded();
    const slugBase = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 32);
    const storeId = `vendor-${slugBase || 'store'}-${Date.now().toString(36)}`;
    const menuId = `m-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;

    const created = await db.transaction(async (tx) => {
      const [insertedStore] = await tx
        .insert(stores)
        .values({
          id: storeId,
          name: input.name.trim(),
          category: input.category.trim(),
          deliveryTime: '25–40 min',
          isCommunity: input.category === 'Community' || true,
          logoUrl: '',
          rating: '4.8',
        })
        .returning();

      const [insertedMenu] = await tx
        .insert(menuItems)
        .values({
          id: menuId,
          storeId: insertedStore.id,
          name: input.dishName.trim(),
          priceCents: input.priceCents,
          available: true,
        })
        .returning();

      return { insertedStore, insertedMenu };
    });

    invalidateStoresCache();

    return {
      id: created.insertedStore.id,
      name: created.insertedStore.name,
      category: created.insertedStore.category,
      time: created.insertedStore.deliveryTime,
      isCommunity: created.insertedStore.isCommunity,
      logo: created.insertedStore.logoUrl,
      menu: [
        {
          id: created.insertedMenu.id,
          storeId: created.insertedMenu.storeId,
          name: created.insertedMenu.name,
          priceCents: created.insertedMenu.priceCents,
          price: Number((created.insertedMenu.priceCents / 100).toFixed(2)),
          available: created.insertedMenu.available,
        },
      ],
    };
  } catch (error) {
    console.error('Database query failed in createVendorStore:', error);
    throw new Error('Failed to create vendor store.', { cause: error });
  }
}

export async function addMenuItemToStore(input: {
  storeName: string;
  itemName: string;
  priceCents: number;
}) {
  try {
    await ensureSeeded();
    const storeRows = await db
      .select()
      .from(stores)
      .where(eq(stores.name, input.storeName))
      .limit(1);

    const store = storeRows[0];
    if (!store) {
      return null;
    }

    const [inserted] = await db
      .insert(menuItems)
      .values({
        id: `m-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
        storeId: store.id,
        name: input.itemName.trim(),
        priceCents: input.priceCents,
        available: true,
      })
      .returning();

    invalidateStoresCache();
    return inserted;
  } catch (error) {
    console.error('Database query failed in addMenuItemToStore:', error);
    throw new Error('Failed to add menu item.', { cause: error });
  }
}

async function hydrateOrders(orderRows: Array<typeof orders.$inferSelect>): Promise<OrderDTO[]> {
  if (!orderRows.length) return [];
  const orderIds = orderRows.map((o) => o.id);

  const [allItems, allStatuses] = await Promise.all([
    db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
    db.select().from(orderStoreStatuses).where(inArray(orderStoreStatuses.orderId, orderIds)),
  ]);

  const itemsByOrder = new Map<string, OrderDTO['items']>();
  for (const item of allItems) {
    const arr = itemsByOrder.get(item.orderId) ?? [];
    arr.push({
      id: item.id,
      orderId: item.orderId,
      storeId: item.storeId,
      storeName: item.storeName,
      itemId: item.itemId,
      itemName: item.itemName,
      priceCents: item.priceCents,
      price: Number((item.priceCents / 100).toFixed(2)),
      qty: item.qty,
    });
    itemsByOrder.set(item.orderId, arr);
  }

  const readinessByOrder = new Map<string, Record<string, boolean>>();
  const prepStatusesByOrder = new Map<string, Record<string, StorePrepStatus>>();
  const storesByOrder = new Map<string, string[]>();
  for (const st of allStatuses) {
    const map = readinessByOrder.get(st.orderId) ?? {};
    map[st.storeName] = st.isReady;
    readinessByOrder.set(st.orderId, map);

    const prepMap = prepStatusesByOrder.get(st.orderId) ?? {};
    const normalizedPrep: StorePrepStatus =
      st.prepStatus === 'Preparing' || st.prepStatus === 'Ready'
        ? st.prepStatus
        : st.isReady
        ? 'Ready'
        : 'Received';
    prepMap[st.storeName] = normalizedPrep;
    prepStatusesByOrder.set(st.orderId, prepMap);

    const list = storesByOrder.get(st.orderId) ?? [];
    if (!list.includes(st.storeName)) list.push(st.storeName);
    storesByOrder.set(st.orderId, list);
  }

  return orderRows.map((o) => ({
    id: o.id,
    buyerId: o.buyerId,
    buyerEmail: o.buyerEmail,
    buyerName: o.buyerName,
    address: o.deliveryAddress,
    deliveryFeeCents: o.deliveryFeeCents,
    totalCents: o.totalCents,
    total: Number((o.totalCents / 100).toFixed(2)),
    paymentMethod: (o.paymentMethod as PaymentMethod) || 'card',
    paymentStatus: (o.paymentStatus as PaymentStatus) || 'Paid',
    paymentReference: o.paymentReference ?? '',
    paymentDetails: o.paymentDetails ?? 'Card Payment',
    status: o.status,
    driverId: o.driverId ?? null,
    driverName: o.driverName ?? null,
    stores: storesByOrder.get(o.id) ?? [],
    storeReadiness: readinessByOrder.get(o.id) ?? {},
    storePrepStatuses: prepStatusesByOrder.get(o.id) ?? {},
    items: itemsByOrder.get(o.id) ?? [],
    createdAt: o.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAtIso: o.createdAt.toISOString(),
  }));
}

export async function getOrdersForUser(user: UserProfile): Promise<OrderDTO[]> {
  try {
    await ensureSeeded();

    if (user.role === 'buyer') {
      const rows = await db
        .select()
        .from(orders)
        .where(eq(orders.buyerId, user.id))
        .orderBy(desc(orders.createdAt))
        .limit(50);
      return hydrateOrders(rows);
    }

    if (user.role === 'store') {
      const targetStore = user.storeName || 'KFC';
      const statusRows = await db
        .select({ orderId: orderStoreStatuses.orderId })
        .from(orderStoreStatuses)
        .where(eq(orderStoreStatuses.storeName, targetStore));

      const orderIds = [...new Set(statusRows.map((r) => r.orderId))];
      if (!orderIds.length) return [];

      const rows = await db
        .select()
        .from(orders)
        .where(
          and(
            inArray(orders.id, orderIds),
            inArray(orders.paymentStatus, ['Paid', 'Cash on Delivery'])
          )
        )
        .orderBy(desc(orders.createdAt))
        .limit(50);
      return hydrateOrders(rows);
    }

    if (user.role === 'driver') {
      const rows = await db
        .select()
        .from(orders)
        .where(inArray(orders.paymentStatus, ['Paid', 'Cash on Delivery']))
        .orderBy(desc(orders.createdAt))
        .limit(100);
      return hydrateOrders(rows);
    }

    // Admins see all orders
    const rows = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(100);
    return hydrateOrders(rows);
  } catch (error) {
    console.error('Database query failed in getOrdersForUser:', error);
    throw new Error('Failed to load orders.', { cause: error });
  }
}

export async function createMultiStoreOrder(input: {
  buyer: UserProfile;
  address: string;
  items: Array<{ itemId: string; qty: number }>;
  payment: {
    method: PaymentMethod;
    paymentStatus: PaymentStatus;
    paymentDetails: string;
  };
}): Promise<OrderDTO> {
  try {
    await ensureSeeded();
    const itemIds = [...new Set(input.items.map((i) => i.itemId))];
    const dbMenuRows = await db
      .select({
        itemId: menuItems.id,
        itemName: menuItems.name,
        priceCents: menuItems.priceCents,
        storeId: stores.id,
        storeName: stores.name,
      })
      .from(menuItems)
      .innerJoin(stores, eq(menuItems.storeId, stores.id))
      .where(inArray(menuItems.id, itemIds));

    const menuById = new Map(dbMenuRows.map((r) => [r.itemId, r]));

    let subtotalCents = 0;
    const resolvedItems: Array<{
      storeId: string;
      storeName: string;
      itemId: string;
      itemName: string;
      priceCents: number;
      qty: number;
    }> = [];

    for (const reqItem of input.items) {
      const dbItem = menuById.get(reqItem.itemId);
      if (!dbItem) {
        throw new Error(`UNKNOWN_ITEM:${reqItem.itemId}`);
      }
      subtotalCents += dbItem.priceCents * reqItem.qty;
      resolvedItems.push({
        storeId: dbItem.storeId,
        storeName: dbItem.storeName,
        itemId: dbItem.itemId,
        itemName: dbItem.itemName,
        priceCents: dbItem.priceCents,
        qty: reqItem.qty,
      });
    }

    const totalCents = subtotalCents + FLAT_DELIVERY_FEE_CENTS;
    const orderId = `ORD-${crypto.randomInt(1000, 9999)}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
    const paymentReference =
      input.payment.paymentStatus === 'Paid'
        ? `PAY-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
        : `COD-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const uniqueStoresMap = new Map<string, string>();
    for (const item of resolvedItems) {
      if (!uniqueStoresMap.has(item.storeName)) {
        uniqueStoresMap.set(item.storeName, item.storeId);
      }
    }

    const insertedOrder = await db.transaction(async (tx) => {
      const [createdOrder] = await tx
        .insert(orders)
        .values({
          id: orderId,
          buyerId: input.buyer.id,
          buyerEmail: input.buyer.email,
          buyerName: input.buyer.name,
          deliveryAddress: input.address,
          deliveryFeeCents: FLAT_DELIVERY_FEE_CENTS,
          totalCents,
          paymentMethod: input.payment.method,
          paymentStatus: input.payment.paymentStatus,
          paymentReference,
          paymentDetails: input.payment.paymentDetails,
          paidAt: input.payment.paymentStatus === 'Paid' ? new Date() : null,
          status: ORDER_STATUS.PREPARING,
        })
        .returning();

      await tx.insert(orderItems).values(
        resolvedItems.map((item) => ({
          orderId,
          storeId: item.storeId,
          storeName: item.storeName,
          itemId: item.itemId,
          itemName: item.itemName,
          priceCents: item.priceCents,
          qty: item.qty,
        }))
      );

      await tx.insert(orderStoreStatuses).values(
        Array.from(uniqueStoresMap.entries()).map(([storeName, storeId]) => ({
          orderId,
          storeId,
          storeName,
          prepStatus: 'Received',
          isReady: false,
        }))
      );

      return createdOrder;
    });

    const [hydrated] = await hydrateOrders([insertedOrder]);
    return hydrated;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('UNKNOWN_ITEM:')) {
      throw error;
    }
    console.error('Database query failed in createMultiStoreOrder:', error);
    throw new Error('Failed to create multi-store order.', { cause: error });
  }
}

export async function updateOrderStorePrepStatus(
  orderId: string,
  storeName: string,
  nextPrepStatus: 'Preparing' | 'Ready'
): Promise<OrderDTO | null> {
  try {
    await ensureSeeded();
    const updatedOrder = await db.transaction(async (tx) => {
      const [orderRow] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      if (!orderRow) return null;

      const [existingStoreRow] = await tx
        .select()
        .from(orderStoreStatuses)
        .where(
          and(
            eq(orderStoreStatuses.orderId, orderId),
            eq(orderStoreStatuses.storeName, storeName)
          )
        )
        .limit(1);
      if (!existingStoreRow) return null;

      const now = new Date();
      if (nextPrepStatus === 'Preparing') {
        if (existingStoreRow.prepStatus !== 'Ready') {
          await tx
            .update(orderStoreStatuses)
            .set({
              prepStatus: 'Preparing',
              isReady: false,
              startedAt: existingStoreRow.startedAt ?? now,
            })
            .where(eq(orderStoreStatuses.id, existingStoreRow.id));
        }
      } else {
        await tx
          .update(orderStoreStatuses)
          .set({
            prepStatus: 'Ready',
            isReady: true,
            startedAt: existingStoreRow.startedAt ?? now,
            readyAt: existingStoreRow.readyAt ?? now,
          })
          .where(eq(orderStoreStatuses.id, existingStoreRow.id));
      }

      const allStatuses = await tx
        .select()
        .from(orderStoreStatuses)
        .where(eq(orderStoreStatuses.orderId, orderId));

      const readinessMap: Record<string, boolean> = {};
      for (const s of allStatuses) {
        readinessMap[s.storeName] = s.isReady;
      }

      const nextStatus = computeStatusAfterStoreReady(readinessMap, orderRow.status);
      const [finalOrder] = await tx
        .update(orders)
        .set({ status: nextStatus, updatedAt: now })
        .where(eq(orders.id, orderId))
        .returning();

      return finalOrder;
    });

    if (!updatedOrder) return null;
    const [hydrated] = await hydrateOrders([updatedOrder]);
    return hydrated;
  } catch (error) {
    console.error('Database query failed in updateOrderStorePrepStatus:', error);
    throw new Error('Failed to update store preparation status.', { cause: error });
  }
}

export async function markOrderStoreReady(
  orderId: string,
  storeName: string
): Promise<OrderDTO | null> {
  return updateOrderStorePrepStatus(orderId, storeName, 'Ready');
}

export async function acceptOrderDelivery(
  orderId: string,
  driver: UserProfile
): Promise<{ status: 'ok'; order: OrderDTO } | { status: 'not_found' | 'not_ready' | 'already_claimed' }> {
  try {
    await ensureSeeded();
    return await db.transaction(async (tx) => {
      const [orderRow] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      if (!orderRow) return { status: 'not_found' as const };
      if (orderRow.driverId) return { status: 'already_claimed' as const };

      const statuses = await tx
        .select()
        .from(orderStoreStatuses)
        .where(eq(orderStoreStatuses.orderId, orderId));
      const allReady = statuses.length > 0 && statuses.every((s) => s.isReady);
      if (!allReady) return { status: 'not_ready' as const };

      const [claimed] = await tx
        .update(orders)
        .set({
          driverId: driver.id,
          driverName: driver.name,
          status: ORDER_STATUS.OUT_FOR_DELIVERY,
          updatedAt: new Date(),
        })
        .where(and(eq(orders.id, orderId), isNull(orders.driverId)))
        .returning();

      if (!claimed) return { status: 'already_claimed' as const };
      const [hydrated] = await hydrateOrders([claimed]);
      return { status: 'ok' as const, order: hydrated };
    });
  } catch (error) {
    console.error('Database query failed in acceptOrderDelivery:', error);
    throw new Error('Failed to claim delivery.', { cause: error });
  }
}

export async function completeOrderDelivery(
  orderId: string,
  actor: UserProfile
): Promise<{ status: 'ok'; order: OrderDTO } | { status: 'not_found' | 'forbidden' }> {
  try {
    await ensureSeeded();
    const [orderRow] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!orderRow) return { status: 'not_found' };
    if (actor.role !== 'admin' && orderRow.driverId !== actor.id) {
      return { status: 'forbidden' };
    }

    const [updated] = await db
      .update(orders)
      .set({
        status: ORDER_STATUS.DELIVERED,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    const [hydrated] = await hydrateOrders([updated]);
    return { status: 'ok', order: hydrated };
  } catch (error) {
    console.error('Database query failed in completeOrderDelivery:', error);
    throw new Error('Failed to complete delivery.', { cause: error });
  }
}

export async function getAdminOverview(): Promise<AdminOverviewDTO> {
  try {
    await ensureSeeded();
    const [gmvRow, storeCountRow, userCountRow, orderCountRow, recentUsersRows] =
      await Promise.all([
        db
          .select({ total: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int` })
          .from(orders),
        db.select({ count: sql<number>`count(*)::int` }).from(stores),
        db.select({ count: sql<number>`count(*)::int` }).from(users),
        db.select({ count: sql<number>`count(*)::int` }).from(orders),
        db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            storeName: users.storeName,
          })
          .from(users)
          .orderBy(desc(users.createdAt))
          .limit(20),
      ]);

    const totalGmvCents = gmvRow[0]?.total ?? 0;
    return {
      totalGmvCents,
      totalGmv: Number((totalGmvCents / 100).toFixed(2)),
      activeStores: storeCountRow[0]?.count ?? 0,
      registeredUsers: userCountRow[0]?.count ?? 0,
      totalOrders: orderCountRow[0]?.count ?? 0,
      recentUsers: recentUsersRows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as UserRole,
        storeName: u.storeName,
      })),
    };
  } catch (error) {
    console.error('Database query failed in getAdminOverview:', error);
    throw new Error('Failed to load admin overview.', { cause: error });
  }
}

async function hydrateDriverApplications(
  appRows: Array<typeof driverApplications.$inferSelect>
): Promise<DriverApplicationDTO[]> {
  if (!appRows.length) return [];
  const appIds = appRows.map((a) => a.id);
  const docs = await db
    .select({
      id: driverApplicationDocuments.id,
      applicationId: driverApplicationDocuments.applicationId,
      fileName: driverApplicationDocuments.fileName,
      mimeType: driverApplicationDocuments.mimeType,
      sizeBytes: driverApplicationDocuments.sizeBytes,
    })
    .from(driverApplicationDocuments)
    .where(inArray(driverApplicationDocuments.applicationId, appIds));

  const docsByApp = new Map<string, DriverApplicationDTO['documents']>();
  for (const d of docs) {
    const arr = docsByApp.get(d.applicationId) ?? [];
    arr.push({
      id: d.id,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
    });
    docsByApp.set(d.applicationId, arr);
  }

  return appRows.map((a) => ({
    id: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    email: a.email,
    phone: a.phone,
    streetAddress: a.streetAddress,
    streetAddressLine2: a.streetAddressLine2,
    city: a.city,
    stateProvince: a.stateProvince,
    postalCode: a.postalCode,
    dateOfBirth: a.dateOfBirth,
    emergencyContactName: a.emergencyContactName,
    emergencyContactPhone: a.emergencyContactPhone,
    preferredArea: a.preferredArea,
    vehicleType: a.vehicleType,
    driversLicenseType: a.driversLicenseType,
    availability: a.availability,
    hasPriorExperience: a.hasPriorExperience,
    signatureDataUrl: a.signatureDataUrl,
    status: a.status as DriverApplicationStatus,
    documents: docsByApp.get(a.id) ?? [],
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function createDriverApplication(
  payload: DriverOnboardingPayload,
  userId?: number | null
): Promise<DriverApplicationDTO> {
  try {
    await ensureSeeded();
    const applicationId = `DRV-${crypto.randomInt(1000, 9999)}-${Date.now()
      .toString(36)
      .slice(-3)
      .toUpperCase()}`;

    const inserted = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(driverApplications)
        .values({
          id: applicationId,
          userId: userId ?? null,
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          email: payload.email.trim().toLowerCase(),
          phone: payload.phone.trim(),
          streetAddress: payload.streetAddress.trim(),
          streetAddressLine2: payload.streetAddressLine2.trim(),
          city: payload.city.trim(),
          stateProvince: payload.stateProvince.trim(),
          postalCode: payload.postalCode.trim(),
          dateOfBirth: payload.dateOfBirth.trim(),
          emergencyContactName: payload.emergencyContactName.trim(),
          emergencyContactPhone: payload.emergencyContactPhone.trim(),
          preferredArea: payload.preferredArea.trim(),
          vehicleType: payload.vehicleType.trim(),
          driversLicenseType: payload.driversLicenseType.trim(),
          availability: payload.availability.trim(),
          hasPriorExperience: Boolean(payload.hasPriorExperience),
          signatureDataUrl: payload.signatureDataUrl,
          status: 'Pending Review',
        })
        .returning();

      if (payload.documents.length > 0) {
        await tx.insert(driverApplicationDocuments).values(
          payload.documents.map((doc) => ({
            applicationId,
            fileName: doc.fileName.trim(),
            mimeType: doc.mimeType,
            sizeBytes: doc.sizeBytes,
            dataBase64: doc.dataBase64,
          }))
        );
      }

      return created;
    });

    const [hydrated] = await hydrateDriverApplications([inserted]);
    return hydrated;
  } catch (error) {
    console.error('Database query failed in createDriverApplication:', error);
    throw new Error('Failed to submit driver onboarding application.', { cause: error });
  }
}

export async function getDriverApplicationsForUser(
  user: UserProfile
): Promise<DriverApplicationDTO[]> {
  try {
    await ensureSeeded();
    if (user.role === 'admin') {
      const rows = await db
        .select()
        .from(driverApplications)
        .orderBy(desc(driverApplications.createdAt))
        .limit(50);
      return hydrateDriverApplications(rows);
    }

    const rows = await db
      .select()
      .from(driverApplications)
      .where(eq(driverApplications.email, user.email.toLowerCase()))
      .orderBy(desc(driverApplications.createdAt))
      .limit(10);
    return hydrateDriverApplications(rows);
  } catch (error) {
    console.error('Database query failed in getDriverApplicationsForUser:', error);
    throw new Error('Failed to load driver applications.', { cause: error });
  }
}

export async function updateDriverApplicationStatus(
  applicationId: string,
  status: DriverApplicationStatus
): Promise<DriverApplicationDTO | null> {
  try {
    await ensureSeeded();
    const [updated] = await db
      .update(driverApplications)
      .set({ status, updatedAt: new Date() })
      .where(eq(driverApplications.id, applicationId))
      .returning();

    if (!updated) return null;
    const [hydrated] = await hydrateDriverApplications([updated]);
    return hydrated;
  } catch (error) {
    console.error('Database query failed in updateDriverApplicationStatus:', error);
    throw new Error('Failed to update driver application status.', { cause: error });
  }
}

function toOrderMessageDTO(row: typeof orderMessages.$inferSelect): OrderMessageDTO {
  return {
    id: row.id,
    orderId: row.orderId,
    senderId: row.senderId,
    senderName: row.senderName,
    senderRole: row.senderRole === 'driver' ? 'driver' : 'buyer',
    body: row.body,
    createdAt: row.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAtIso: row.createdAt.toISOString(),
  };
}

export async function getOrderMessagesForUser(
  orderId: string,
  actor: UserProfile
): Promise<{ status: 'ok'; messages: OrderMessageDTO[] } | { status: 'not_found' | 'forbidden' }> {
  try {
    await ensureSeeded();
    const [orderRow] = await db
      .select({
        id: orders.id,
        buyerId: orders.buyerId,
        driverId: orders.driverId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!orderRow) return { status: 'not_found' };

    const isBuyer = orderRow.buyerId === actor.id;
    const isAssignedDriver = orderRow.driverId !== null && orderRow.driverId === actor.id;
    if (!isBuyer && !isAssignedDriver) {
      return { status: 'forbidden' };
    }

    const rows = await db
      .select()
      .from(orderMessages)
      .where(eq(orderMessages.orderId, orderId))
      .orderBy(asc(orderMessages.createdAt), asc(orderMessages.id))
      .limit(100);

    return {
      status: 'ok',
      messages: rows.map(toOrderMessageDTO),
    };
  } catch (error) {
    console.error('Database query failed in getOrderMessagesForUser:', error);
    throw new Error('Failed to load order messages.', { cause: error });
  }
}

export async function createOrderMessage(
  orderId: string,
  actor: UserProfile,
  body: string
): Promise<
  | { status: 'ok'; message: OrderMessageDTO; buyerId: number; driverId: number }
  | { status: 'not_found' | 'forbidden' | 'driver_unassigned' }
> {
  try {
    await ensureSeeded();
    const [orderRow] = await db
      .select({
        id: orders.id,
        buyerId: orders.buyerId,
        driverId: orders.driverId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!orderRow) return { status: 'not_found' };

    const access = canUserMessageOrder(
      { buyerId: orderRow.buyerId, driverId: orderRow.driverId },
      actor.id
    );
    if (!access.allowed) {
      return { status: access.reason };
    }

    const [inserted] = await db
      .insert(orderMessages)
      .values({
        orderId,
        senderId: actor.id,
        senderName: actor.name,
        senderRole: access.senderRole,
        body,
      })
      .returning();

    return {
      status: 'ok',
      message: toOrderMessageDTO(inserted),
      buyerId: orderRow.buyerId,
      driverId: orderRow.driverId!,
    };
  } catch (error) {
    console.error('Database query failed in createOrderMessage:', error);
    throw new Error('Failed to send order message.', { cause: error });
  }
}


