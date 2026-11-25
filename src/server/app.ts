import { EventEmitter } from 'node:events';
import compression from 'compression';
import express from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import {
  acceptOrderDelivery,
  addMenuItemToStore,
  completeOrderDelivery,
  createDriverApplication,
  createLocalUser,
  createMultiStoreOrder,
  createOrderMessage,
  createVendorStore,
  getAdminOverview,
  getDriverApplicationsForUser,
  getOrderMessagesForUser,
  getOrdersForUser,
  getStoresWithMenusCached,
  getUserWithPasswordByEmail,
  markOrderStoreReady,
  updateDriverApplicationStatus,
  updateOrderStorePrepStatus,
  upsertGoogleUser,
} from '../db/repository.ts';
import { AuthRequest, authenticateBearerToken, requireAuth, requireRole } from '../middleware/auth.ts';
import { validateDriverOnboarding } from '../utils/driverOnboarding.ts';
import { filterStores, validateEmail, validateVendorPayload } from '../utils/marketplace.ts';
import { validateCheckoutInput, validateOrderMessage, validatePaymentInput } from '../utils/orders.ts';
import { hashPassword, signSessionToken, verifyPassword } from './auth.ts';
import type {
  DriverApplicationStatus,
  DriverOnboardingPayload,
  OrderMessageDTO,
  UserRole,
} from '../types.ts';

const orderEvents = new EventEmitter();
orderEvents.setMaxListeners(200);

function emitOrderSync(orderId: string) {
  orderEvents.emit('order_updated', { orderId, ts: Date.now() });
}

function emitOrderMessageSync(payload: {
  orderId: string;
  buyerId: number;
  driverId: number;
  message: OrderMessageDTO;
}) {
  orderEvents.emit('order_message', payload);
}

export function createApiApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(compression());
  app.use(express.json({ limit: '12mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'hazyeats-api' });
  });

  // Public Marketplace Catalog with ETag + Cache-Control + In-Memory TTL Cache
  app.get('/api/stores', async (req, res) => {
    try {
      const { stores, etag } = await getStoresWithMenusCached();
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const category = typeof req.query.category === 'string' ? req.query.category : 'All';

      if (!q && (!category || category === 'All')) {
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        if (req.headers['if-none-match'] === etag) {
          return res.status(304).end();
        }
        return res.json({ stores });
      }

      const filtered = filterStores(stores, q, category);
      res.setHeader('Cache-Control', 'public, max-age=15');
      return res.json({ stores: filtered });
    } catch (error) {
      console.error('GET /api/stores error:', error);
      return res.status(500).json({ error: 'Unable to load Hazyview stores right now.' });
    }
  });

  // Email/Password Registration
  app.post('/api/auth/register', async (req, res) => {
    try {
      const body = req.body ?? {};
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
      const role = typeof body.role === 'string' ? (body.role as UserRole) : 'buyer';
      const vehicle = typeof body.vehicle === 'string' ? body.vehicle.trim() : '';
      const storeName = typeof body.storeName === 'string' ? body.storeName.trim() : '';
      const adminCode = typeof body.adminCode === 'string' ? body.adminCode.trim() : '';

      if (!validateEmail(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }
      if (!['buyer', 'driver', 'store', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid account role selected.' });
      }

      if (role === 'admin') {
        const expectedCode = process.env.ADMIN_SIGNUP_CODE?.trim();
        if (!expectedCode || adminCode !== expectedCode) {
          return res.status(403).json({
            error:
              'Admin registration requires a valid Admin Access Code, or use the seeded admin account.',
          });
        }
      }

      if (role === 'store' && !storeName) {
        return res.status(400).json({ error: 'Please enter your store or business name.' });
      }

      const existing = await getUserWithPasswordByEmail(email);
      if (existing) {
        return res
          .status(409)
          .json({ error: 'An account with this email already exists. Please sign in.' });
      }

      const user = await createLocalUser({
        email,
        name: name || email.split('@')[0],
        phone,
        role,
        vehicle: role === 'driver' ? vehicle : '',
        storeName: role === 'store' ? storeName : '',
        passwordHash: hashPassword(password),
      });

      const token = signSessionToken({
        uid: user.uid,
        email: user.email,
        role: user.role,
      });

      return res.status(201).json({ user, token });
    } catch (error) {
      console.error('POST /api/auth/register error:', error);
      return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  });

  // Email/Password Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const body = req.body ?? {};
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';

      if (!validateEmail(email) || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const record = await getUserWithPasswordByEmail(email);
      if (!record || !verifyPassword(password, record.passwordHash)) {
        return res
          .status(401)
          .json({ error: 'Invalid email or password. Try a demo account or sign up!' });
      }

      const user = {
        id: record.id,
        uid: record.uid,
        email: record.email,
        name: record.name,
        phone: record.phone,
        role: record.role as UserRole,
        vehicle: record.vehicle,
        storeName: record.storeName,
        authProvider: (record.authProvider === 'google' ? 'google' : 'local') as
          | 'local'
          | 'google',
      };

      const token = signSessionToken({
        uid: user.uid,
        email: user.email,
        role: user.role,
      });

      return res.json({ user, token });
    } catch (error) {
      console.error('POST /api/auth/login error:', error);
      return res.status(500).json({ error: 'Sign in failed. Please try again.' });
    }
  });

  // Firebase Google Sign-In Verification & PostgreSQL User Sync
  app.post('/api/auth/google', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Google ID token.' });
    }

    const idToken = authHeader.slice('Bearer '.length).trim();
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      const body = req.body ?? {};
      const requestedRole =
        typeof body.role === 'string' && ['buyer', 'driver', 'store'].includes(body.role)
          ? (body.role as UserRole)
          : undefined;

      const user = await upsertGoogleUser({
        uid: decoded.uid,
        email: decoded.email || `${decoded.uid}@google.user`,
        name: decoded.name || decoded.email?.split('@')[0] || 'Google User',
        role: requestedRole,
        phone: typeof body.phone === 'string' ? body.phone : undefined,
        vehicle: typeof body.vehicle === 'string' ? body.vehicle : undefined,
        storeName: typeof body.storeName === 'string' ? body.storeName : undefined,
      });

      return res.json({ user });
    } catch (error) {
      console.error('POST /api/auth/google error:', error);
      return res.status(401).json({ error: 'Google token verification failed.' });
    }
  });

  // Current Authenticated Profile
  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.authUser });
  });

  // Real-time SSE Order Synchronization Stream
  app.get('/api/orders/stream', requireAuth, (req: AuthRequest, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (eventName: string, data: unknown) => {
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('connected', { role: req.authUser?.role });

    const onOrderUpdate = (payload: { orderId: string; ts: number }) => {
      sendEvent('order_updated', payload);
    };

    const onOrderMessage = (payload: {
      orderId: string;
      buyerId: number;
      driverId: number;
      message: OrderMessageDTO;
    }) => {
      const uid = req.authUser?.id;
      if (uid !== payload.buyerId && uid !== payload.driverId) {
        return;
      }
      sendEvent('order_message', {
        orderId: payload.orderId,
        message: payload.message,
      });
    };

    orderEvents.on('order_updated', onOrderUpdate);
    orderEvents.on('order_message', onOrderMessage);
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      orderEvents.off('order_updated', onOrderUpdate);
      orderEvents.off('order_message', onOrderMessage);
    });
  });

  // Role-Scoped Order Listing
  app.get('/api/orders', requireAuth, async (req: AuthRequest, res) => {
    try {
      const orders = await getOrdersForUser(req.authUser!);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ orders });
    } catch (error) {
      console.error('GET /api/orders error:', error);
      return res.status(500).json({ error: 'Failed to load orders.' });
    }
  });

  // Place Multi-Store Order (Server-Verified Prices, Payment Confirmation & Transactional)
  app.post('/api/orders', requireAuth, async (req: AuthRequest, res) => {
    try {
      const body = req.body ?? {};
      const items = Array.isArray(body.items) ? body.items : [];
      const address = typeof body.address === 'string' ? body.address : '';
      const rawPayment = body.payment && typeof body.payment === 'object' ? body.payment : null;

      const validation = validateCheckoutInput(items, address);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      if (!rawPayment) {
        return res.status(400).json({ error: 'Please select and complete a payment option.' });
      }

      const paymentCheck = validatePaymentInput({
        method: rawPayment.method,
        cardHolder: typeof rawPayment.cardHolder === 'string' ? rawPayment.cardHolder : undefined,
        cardNumber: typeof rawPayment.cardNumber === 'string' ? rawPayment.cardNumber : undefined,
        cardExpiry: typeof rawPayment.cardExpiry === 'string' ? rawPayment.cardExpiry : undefined,
        cardCvv: typeof rawPayment.cardCvv === 'string' ? rawPayment.cardCvv : undefined,
        eftBank: typeof rawPayment.eftBank === 'string' ? rawPayment.eftBank : undefined,
        snapCode: typeof rawPayment.snapCode === 'string' ? rawPayment.snapCode : undefined,
      });

      if (!paymentCheck.valid) {
        return res.status(400).json({ error: paymentCheck.error });
      }

      const order = await createMultiStoreOrder({
        buyer: req.authUser!,
        address: validation.address,
        items: items.map((i: { itemId: string; qty: number }) => ({
          itemId: String(i.itemId),
          qty: Number(i.qty),
        })),
        payment: {
          method: paymentCheck.method,
          paymentStatus: paymentCheck.paymentStatus,
          paymentDetails: paymentCheck.paymentDetails,
        },
      });

      emitOrderSync(order.id);
      return res.status(201).json({ order });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('UNKNOWN_ITEM:')) {
        return res.status(400).json({ error: 'One or more menu items could not be found.' });
      }
      console.error('POST /api/orders error:', error);
      return res.status(500).json({ error: 'Could not place order. Please try again.' });
    }
  });

  // Store Updates Its Preparation Status ('Preparing' or 'Ready')
  app.patch(
    '/api/orders/:id/store-status',
    requireAuth,
    requireRole('store', 'admin'),
    async (req: AuthRequest, res) => {
      try {
        const orderId = String(req.params.id);
        const requestedStore =
          typeof req.body?.storeName === 'string' ? req.body.storeName.trim() : '';
        const targetStore =
          req.authUser!.role === 'admin' && requestedStore
            ? requestedStore
            : req.authUser!.storeName || requestedStore;

        const nextStatus = req.body?.status;
        if (nextStatus !== 'Preparing' && nextStatus !== 'Ready') {
          return res
            .status(400)
            .json({ error: 'Invalid status. Must be Preparing or Ready.' });
        }

        if (!targetStore) {
          return res.status(400).json({ error: 'Store name is required.' });
        }

        if (
          req.authUser!.role === 'store' &&
          req.authUser!.storeName &&
          requestedStore &&
          requestedStore !== req.authUser!.storeName
        ) {
          return res
            .status(403)
            .json({ error: 'You can only update your own store orders.' });
        }

        const updated = await updateOrderStorePrepStatus(orderId, targetStore, nextStatus);
        if (!updated) {
          return res.status(404).json({ error: 'Order or store item not found.' });
        }

        emitOrderSync(updated.id);
        return res.json({ order: updated });
      } catch (error) {
        console.error('PATCH /api/orders/:id/store-status error:', error);
        return res.status(500).json({ error: 'Failed to update store preparation status.' });
      }
    }
  );

  // Store Marks Its Portion Ready (Legacy alias kept in sync)
  app.patch(
    '/api/orders/:id/store-ready',
    requireAuth,
    requireRole('store', 'admin'),
    async (req: AuthRequest, res) => {
      try {
        const orderId = String(req.params.id);
        const requestedStore =
          typeof req.body?.storeName === 'string' ? req.body.storeName.trim() : '';
        const targetStore =
          req.authUser!.role === 'admin' && requestedStore
            ? requestedStore
            : req.authUser!.storeName || requestedStore;

        if (!targetStore) {
          return res.status(400).json({ error: 'Store name is required.' });
        }

        if (
          req.authUser!.role === 'store' &&
          req.authUser!.storeName &&
          requestedStore &&
          requestedStore !== req.authUser!.storeName
        ) {
          return res
            .status(403)
            .json({ error: 'You can only mark your own store items ready.' });
        }

        const updated = await markOrderStoreReady(orderId, targetStore);
        if (!updated) {
          return res.status(404).json({ error: 'Order or store item not found.' });
        }

        emitOrderSync(updated.id);
        return res.json({ order: updated });
      } catch (error) {
        console.error('PATCH /api/orders/:id/store-ready error:', error);
        return res.status(500).json({ error: 'Failed to update store readiness.' });
      }
    }
  );

  // Driver Accepts Multi-Store Pickup (Only When All Stores Are Ready)
  app.patch(
    '/api/orders/:id/accept-delivery',
    requireAuth,
    requireRole('driver', 'admin'),
    async (req: AuthRequest, res) => {
      try {
        const orderId = String(req.params.id);
        const result = await acceptOrderDelivery(orderId, req.authUser!);

        if (result.status !== 'ok') {
          if (result.status === 'not_found') {
            return res.status(404).json({ error: 'Order not found.' });
          }
          if (result.status === 'not_ready') {
            return res
              .status(409)
              .json({ error: 'Pickup unlocks once every store marks its food ready.' });
          }
          return res
            .status(409)
            .json({ error: 'Another driver has already claimed this pickup.' });
        }

        emitOrderSync(result.order.id);
        return res.json({ order: result.order });
      } catch (error) {
        console.error('PATCH /api/orders/:id/accept-delivery error:', error);
        return res.status(500).json({ error: 'Failed to accept delivery.' });
      }
    }
  );

  // Driver Completes Delivery
  app.patch(
    '/api/orders/:id/complete-delivery',
    requireAuth,
    requireRole('driver', 'admin'),
    async (req: AuthRequest, res) => {
      try {
        const orderId = String(req.params.id);
        const result = await completeOrderDelivery(orderId, req.authUser!);

        if (result.status !== 'ok') {
          if (result.status === 'not_found') {
            return res.status(404).json({ error: 'Order not found.' });
          }
          return res
            .status(403)
            .json({ error: 'Only the assigned driver can complete this delivery.' });
        }

        emitOrderSync(result.order.id);
        return res.json({ order: result.order });
      } catch (error) {
        console.error('PATCH /api/orders/:id/complete-delivery error:', error);
        return res.status(500).json({ error: 'Failed to complete delivery.' });
      }
    }
  );

  // Buyer & Assigned Driver: List Direct Order Messages
  app.get('/api/orders/:id/messages', requireAuth, async (req: AuthRequest, res) => {
    try {
      const orderId = String(req.params.id);
      const result = await getOrderMessagesForUser(orderId, req.authUser!);
      if (result.status !== 'ok') {
        if (result.status === 'not_found') {
          return res.status(404).json({ error: 'Order not found.' });
        }
        return res
          .status(403)
          .json({ error: 'Only the customer or assigned driver can view order messages.' });
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ messages: result.messages });
    } catch (error) {
      console.error('GET /api/orders/:id/messages error:', error);
      return res.status(500).json({ error: 'Failed to load order messages.' });
    }
  });

  // Buyer & Assigned Driver: Send Direct Order Message
  app.post('/api/orders/:id/messages', requireAuth, async (req: AuthRequest, res) => {
    try {
      const orderId = String(req.params.id);
      const rawBody = typeof req.body?.body === 'string' ? req.body.body : '';
      const validation = validateOrderMessage(rawBody);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const result = await createOrderMessage(orderId, req.authUser!, validation.body);
      if (result.status !== 'ok') {
        if (result.status === 'not_found') {
          return res.status(404).json({ error: 'Order not found.' });
        }
        if (result.status === 'forbidden') {
          return res
            .status(403)
            .json({ error: 'Only the customer or assigned driver can send order messages.' });
        }
        return res
          .status(409)
          .json({ error: 'Direct messaging unlocks once a driver accepts this order.' });
      }

      emitOrderMessageSync({
        orderId,
        buyerId: result.buyerId,
        driverId: result.driverId,
        message: result.message,
      });

      return res.status(201).json({ message: result.message });
    } catch (error) {
      console.error('POST /api/orders/:id/messages error:', error);
      return res.status(500).json({ error: 'Failed to send order message.' });
    }
  });

  // Admin: Onboard New Store / Vendor
  app.post(
    '/api/stores',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res) => {
      try {
        const body = req.body ?? {};
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const category = typeof body.category === 'string' ? body.category.trim() : '';
        const dishName = typeof body.dishName === 'string' ? body.dishName.trim() : '';
        const priceZar = Number(body.priceZar);

        const validation = validateVendorPayload({ name, category, dishName, priceZar });
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }

        const created = await createVendorStore({
          name,
          category,
          dishName,
          priceCents: Math.round(priceZar * 100),
        });

        return res.status(201).json({ store: created });
      } catch (error) {
        console.error('POST /api/stores error:', error);
        return res.status(500).json({ error: 'Failed to onboard vendor.' });
      }
    }
  );

  // Store / Admin: Add Menu Item to Store
  app.post(
    '/api/stores/:storeName/menu',
    requireAuth,
    requireRole('store', 'admin'),
    async (req: AuthRequest, res) => {
      try {
        const targetStoreName = decodeURIComponent(String(req.params.storeName));
        if (
          req.authUser!.role === 'store' &&
          req.authUser!.storeName &&
          req.authUser!.storeName !== targetStoreName
        ) {
          return res
            .status(403)
            .json({ error: 'You can only add menu items to your own store.' });
        }

        const itemName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        const priceZar = Number(req.body?.priceZar);
        if (itemName.length < 2 || !Number.isFinite(priceZar) || priceZar <= 0) {
          return res.status(400).json({ error: 'Valid item name and ZAR price are required.' });
        }

        const inserted = await addMenuItemToStore({
          storeName: targetStoreName,
          itemName,
          priceCents: Math.round(priceZar * 100),
        });
        if (!inserted) {
          return res.status(404).json({ error: 'Store not found.' });
        }

        return res.status(201).json({
          item: {
            id: inserted.id,
            storeId: inserted.storeId,
            name: inserted.name,
            priceCents: inserted.priceCents,
            price: Number((inserted.priceCents / 100).toFixed(2)),
            available: inserted.available,
          },
        });
      } catch (error) {
        console.error('POST /api/stores/:storeName/menu error:', error);
        return res.status(500).json({ error: 'Failed to add menu item.' });
      }
    }
  );

  // Admin: Command Center Overview
  app.get(
    '/api/admin/overview',
    requireAuth,
    requireRole('admin'),
    async (_req: AuthRequest, res) => {
      try {
        const overview = await getAdminOverview();
        return res.json({ overview });
      } catch (error) {
        console.error('GET /api/admin/overview error:', error);
        return res.status(500).json({ error: 'Failed to load admin metrics.' });
      }
    }
  );

  // Driver Onboarding: Submit Application (Public or Authenticated)
  app.post('/api/driver-applications', async (req, res) => {
    try {
      let linkedUserId: number | null = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length).trim();
        if (token) {
          const authUser = await authenticateBearerToken(token);
          linkedUserId = authUser?.id ?? null;
        }
      }

      const body = req.body ?? {};
      const payload: DriverOnboardingPayload = {
        firstName: typeof body.firstName === 'string' ? body.firstName : '',
        lastName: typeof body.lastName === 'string' ? body.lastName : '',
        email: typeof body.email === 'string' ? body.email : '',
        phone: typeof body.phone === 'string' ? body.phone : '',
        streetAddress: typeof body.streetAddress === 'string' ? body.streetAddress : '',
        streetAddressLine2:
          typeof body.streetAddressLine2 === 'string' ? body.streetAddressLine2 : '',
        city: typeof body.city === 'string' ? body.city : '',
        stateProvince: typeof body.stateProvince === 'string' ? body.stateProvince : '',
        postalCode: typeof body.postalCode === 'string' ? body.postalCode : '',
        dateOfBirth: typeof body.dateOfBirth === 'string' ? body.dateOfBirth : '',
        emergencyContactName:
          typeof body.emergencyContactName === 'string' ? body.emergencyContactName : '',
        emergencyContactPhone:
          typeof body.emergencyContactPhone === 'string' ? body.emergencyContactPhone : '',
        preferredArea: typeof body.preferredArea === 'string' ? body.preferredArea : '',
        vehicleType: typeof body.vehicleType === 'string' ? body.vehicleType : '',
        driversLicenseType:
          typeof body.driversLicenseType === 'string' ? body.driversLicenseType : '',
        availability: typeof body.availability === 'string' ? body.availability : '',
        hasPriorExperience:
          typeof body.hasPriorExperience === 'boolean' ? body.hasPriorExperience : null,
        documents: Array.isArray(body.documents) ? body.documents : [],
        signatureDataUrl:
          typeof body.signatureDataUrl === 'string' ? body.signatureDataUrl : '',
      };

      const validation = validateDriverOnboarding(payload);
      if (!validation.valid) {
        const firstError = Object.values(validation.errors)[0] || 'Invalid form fields.';
        return res.status(400).json({ error: firstError, fieldErrors: validation.errors });
      }

      const created = await createDriverApplication(payload, linkedUserId);
      return res.status(201).json({ application: created });
    } catch (error) {
      console.error('POST /api/driver-applications error:', error);
      return res.status(500).json({ error: 'Failed to submit driver application.' });
    }
  });

  // Driver / Admin: View Driver Onboarding Applications
  app.get('/api/driver-applications', requireAuth, async (req: AuthRequest, res) => {
    try {
      const applications = await getDriverApplicationsForUser(req.authUser!);
      return res.json({ applications });
    } catch (error) {
      console.error('GET /api/driver-applications error:', error);
      return res.status(500).json({ error: 'Failed to load driver applications.' });
    }
  });

  // Admin: Approve / Reject Driver Application
  app.patch(
    '/api/driver-applications/:id/status',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res) => {
      try {
        const id = String(req.params.id);
        const status = req.body?.status as DriverApplicationStatus;
        if (!['Pending Review', 'Approved', 'Rejected'].includes(status)) {
          return res.status(400).json({ error: 'Invalid application status.' });
        }
        const updated = await updateDriverApplicationStatus(id, status);
        if (!updated) {
          return res.status(404).json({ error: 'Application not found.' });
        }
        return res.json({ application: updated });
      } catch (error) {
        console.error('PATCH /api/driver-applications/:id/status error:', error);
        return res.status(500).json({ error: 'Failed to update application status.' });
      }
    }
  );

  return app;
}
