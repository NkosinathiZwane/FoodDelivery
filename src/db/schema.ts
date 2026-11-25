import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    phone: text('phone').notNull().default(''),
    role: text('role').notNull().default('buyer'),
    vehicle: text('vehicle').notNull().default(''),
    storeName: text('store_name').notNull().default(''),
    passwordHash: text('password_hash'),
    authProvider: text('auth_provider').notNull().default('local'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('users_role_idx').on(table.role),
    index('users_email_idx').on(table.email),
  ]
);

export const stores = pgTable(
  'stores',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    category: text('category').notNull(),
    deliveryTime: text('delivery_time').notNull().default('30–45 min'),
    isCommunity: boolean('is_community').notNull().default(false),
    logoUrl: text('logo_url').notNull().default(''),
    rating: text('rating').notNull().default('4.8'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('stores_category_idx').on(table.category)]
);

export const menuItems = pgTable(
  'menu_items',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    priceCents: integer('price_cents').notNull(),
    available: boolean('available').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('menu_items_store_id_idx').on(table.storeId)]
);

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    buyerId: integer('buyer_id')
      .notNull()
      .references(() => users.id),
    buyerEmail: text('buyer_email').notNull(),
    buyerName: text('buyer_name').notNull(),
    deliveryAddress: text('delivery_address').notNull(),
    deliveryFeeCents: integer('delivery_fee_cents').notNull().default(2000),
    totalCents: integer('total_cents').notNull(),
    paymentMethod: text('payment_method').notNull().default('card'),
    paymentStatus: text('payment_status').notNull().default('Paid'),
    paymentReference: text('payment_reference').notNull().default(''),
    paymentDetails: text('payment_details').notNull().default('Card Payment'),
    paidAt: timestamp('paid_at'),
    status: text('status').notNull().default('Preparing at Stores'),
    driverId: integer('driver_id').references(() => users.id),
    driverName: text('driver_name'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('orders_buyer_id_idx').on(table.buyerId),
    index('orders_status_idx').on(table.status),
    index('orders_created_at_idx').on(table.createdAt),
  ]
);

export const orderItems = pgTable(
  'order_items',
  {
    id: serial('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    storeId: text('store_id').notNull(),
    storeName: text('store_name').notNull(),
    itemId: text('item_id').notNull(),
    itemName: text('item_name').notNull(),
    priceCents: integer('price_cents').notNull(),
    qty: integer('qty').notNull(),
  },
  (table) => [index('order_items_order_id_idx').on(table.orderId)]
);

export const orderStoreStatuses = pgTable(
  'order_store_statuses',
  {
    id: serial('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    storeId: text('store_id').notNull(),
    storeName: text('store_name').notNull(),
    prepStatus: text('prep_status').notNull().default('Received'),
    isReady: boolean('is_ready').notNull().default(false),
    startedAt: timestamp('started_at'),
    readyAt: timestamp('ready_at'),
  },
  (table) => [
    uniqueIndex('order_store_unique_idx').on(table.orderId, table.storeName),
    index('order_store_name_idx').on(table.storeName),
  ]
);

export const orderMessages = pgTable(
  'order_messages',
  {
    id: serial('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    senderId: integer('sender_id')
      .notNull()
      .references(() => users.id),
    senderName: text('sender_name').notNull(),
    senderRole: text('sender_role').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('order_messages_order_id_idx').on(table.orderId, table.createdAt)]
);

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
}));

export const storesRelations = relations(stores, ({ many }) => ({
  menuItems: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  store: one(stores, {
    fields: [menuItems.storeId],
    references: [stores.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  buyer: one(users, {
    fields: [orders.buyerId],
    references: [users.id],
  }),
  items: many(orderItems),
  storeStatuses: many(orderStoreStatuses),
  messages: many(orderMessages),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export const orderStoreStatusesRelations = relations(orderStoreStatuses, ({ one }) => ({
  order: one(orders, {
    fields: [orderStoreStatuses.orderId],
    references: [orders.id],
  }),
}));

export const orderMessagesRelations = relations(orderMessages, ({ one }) => ({
  order: one(orders, {
    fields: [orderMessages.orderId],
    references: [orders.id],
  }),
  sender: one(users, {
    fields: [orderMessages.senderId],
    references: [users.id],
  }),
}));

export const driverApplications = pgTable(
  'driver_applications',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id').references(() => users.id),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    streetAddress: text('street_address').notNull(),
    streetAddressLine2: text('street_address_line2').notNull().default(''),
    city: text('city').notNull(),
    stateProvince: text('state_province').notNull(),
    postalCode: text('postal_code').notNull(),
    dateOfBirth: text('date_of_birth').notNull(),
    emergencyContactName: text('emergency_contact_name').notNull(),
    emergencyContactPhone: text('emergency_contact_phone').notNull(),
    preferredArea: text('preferred_area').notNull(),
    vehicleType: text('vehicle_type').notNull(),
    driversLicenseType: text('drivers_license_type').notNull(),
    availability: text('availability').notNull(),
    hasPriorExperience: boolean('has_prior_experience').notNull(),
    signatureDataUrl: text('signature_data_url').notNull(),
    status: text('status').notNull().default('Pending Review'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('driver_apps_email_idx').on(table.email),
    index('driver_apps_status_idx').on(table.status),
    index('driver_apps_created_at_idx').on(table.createdAt),
  ]
);

export const driverApplicationDocuments = pgTable(
  'driver_application_documents',
  {
    id: serial('id').primaryKey(),
    applicationId: text('application_id')
      .notNull()
      .references(() => driverApplications.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    dataBase64: text('data_base64').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('driver_app_docs_app_id_idx').on(table.applicationId)]
);

export const driverApplicationsRelations = relations(driverApplications, ({ many }) => ({
  documents: many(driverApplicationDocuments),
}));

export const driverApplicationDocumentsRelations = relations(
  driverApplicationDocuments,
  ({ one }) => ({
    application: one(driverApplications, {
      fields: [driverApplicationDocuments.applicationId],
      references: [driverApplications.id],
    }),
  })
);

