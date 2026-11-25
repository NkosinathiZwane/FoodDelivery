import { db } from './index.ts';
import { driverApplications, menuItems, stores, users } from './schema.ts';
import { hashPassword } from '../server/auth.ts';
import { INITIAL_STORES_SEED } from './catalog.ts';
import {
  PROTOTYPE_DRIVER_PROFILES_SEED,
  PROTOTYPE_USERS_SEED,
  getPrototypeSignatureDataUrl,
} from './seedUsers.ts';
import { invalidateStoresCache } from './repository.ts';

export { INITIAL_STORES_SEED };

let seedPromise: Promise<void> | null = null;
let seededDone = false;

export async function ensureSeeded(): Promise<void> {
  if (seededDone) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      const existingStores = await db.select({ id: stores.id }).from(stores);
      const existingStoreIds = new Set(existingStores.map((row) => row.id));
      const missingStores = INITIAL_STORES_SEED.filter((s) => !existingStoreIds.has(s.id));

      let catalogChanged = false;
      if (missingStores.length > 0) {
        await db
          .insert(stores)
          .values(
            missingStores.map((s) => ({
              id: s.id,
              name: s.name,
              category: s.category,
              deliveryTime: s.deliveryTime,
              isCommunity: s.isCommunity,
              logoUrl: s.logoUrl,
              rating: '4.8',
            }))
          )
          .onConflictDoNothing();
        catalogChanged = true;
      }

      const existingMenus = await db.select({ id: menuItems.id }).from(menuItems);
      const existingMenuIds = new Set(existingMenus.map((row) => row.id));
      const missingMenuRows = INITIAL_STORES_SEED.flatMap((s) =>
        s.menu
          .filter((m) => !existingMenuIds.has(m.id))
          .map((m) => ({
            id: m.id,
            storeId: s.id,
            name: m.name,
            priceCents: m.priceCents,
            available: true,
          }))
      );

      if (missingMenuRows.length > 0) {
        await db.insert(menuItems).values(missingMenuRows).onConflictDoNothing();
        catalogChanged = true;
      }

      if (catalogChanged) {
        invalidateStoresCache();
      }

      const existingUsers = await db
        .select({ id: users.id, email: users.email })
        .from(users);
      const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));
      const missingUsers = PROTOTYPE_USERS_SEED.filter(
        (u) => !existingEmails.has(u.email.toLowerCase())
      );

      if (missingUsers.length > 0) {
        const demoPasswordHash = hashPassword('Demo@1234');
        await db
          .insert(users)
          .values(
            missingUsers.map((u) => ({
              uid: u.uid,
              name: u.name,
              email: u.email.toLowerCase(),
              role: u.role,
              phone: u.phone,
              vehicle: u.vehicle,
              storeName: u.storeName,
              passwordHash: demoPasswordHash,
              authProvider: 'local',
            }))
          )
          .onConflictDoNothing();
      }

      const allUsers = await db
        .select({ id: users.id, email: users.email })
        .from(users);
      const userIdByEmail = new Map(allUsers.map((u) => [u.email.toLowerCase(), u.id]));

      const existingDriverApps = await db
        .select({ id: driverApplications.id })
        .from(driverApplications);
      const existingDriverAppIds = new Set(existingDriverApps.map((a) => a.id));
      const missingDriverApps = PROTOTYPE_DRIVER_PROFILES_SEED.filter(
        (d) => !existingDriverAppIds.has(d.id)
      );

      if (missingDriverApps.length > 0) {
        const signatureDataUrl = getPrototypeSignatureDataUrl();
        await db
          .insert(driverApplications)
          .values(
            missingDriverApps.map((d) => ({
              id: d.id,
              userId: userIdByEmail.get(d.userEmail.toLowerCase()) ?? null,
              firstName: d.firstName,
              lastName: d.lastName,
              email: d.email.toLowerCase(),
              phone: d.phone,
              streetAddress: d.streetAddress,
              streetAddressLine2: d.streetAddressLine2,
              city: d.city,
              stateProvince: d.stateProvince,
              postalCode: d.postalCode,
              dateOfBirth: d.dateOfBirth,
              emergencyContactName: d.emergencyContactName,
              emergencyContactPhone: d.emergencyContactPhone,
              preferredArea: d.preferredArea,
              vehicleType: d.vehicleType,
              driversLicenseType: d.driversLicenseType,
              availability: d.availability,
              hasPriorExperience: d.hasPriorExperience,
              signatureDataUrl,
              status: 'Approved',
            }))
          )
          .onConflictDoNothing();
      }

      seededDone = true;
    } catch (error) {
      seedPromise = null;
      throw error;
    }
  })();

  return seedPromise;
}
