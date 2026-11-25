import type { UserRole } from '../types.ts';

export interface PrototypeUserSeed {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  vehicle: string;
  storeName: string;
}

export interface PrototypeDriverProfileSeed {
  id: string;
  userEmail: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  streetAddress: string;
  streetAddressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  preferredArea: string;
  vehicleType: string;
  driversLicenseType: string;
  availability: string;
  hasPriorExperience: boolean;
}

const PROTOTYPE_SIG_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50" viewBox="0 0 200 50"><path d="M12 34 C 34 10, 56 42, 84 20 C 106 8, 128 38, 182 18" fill="none" stroke="#d4af37" stroke-width="2.5" stroke-linecap="round"/></svg>'
  );

export function getPrototypeSignatureDataUrl(): string {
  return PROTOTYPE_SIG_SVG;
}

export const PROTOTYPE_USERS_SEED: PrototypeUserSeed[] = [
  // Buyers (5)
  {
    uid: 'demo-buyer-1',
    name: 'Thabo Buyer',
    email: 'buyer@hazyeats.demo',
    role: 'buyer',
    phone: '071 234 5678',
    vehicle: '',
    storeName: '',
  },
  {
    uid: 'demo-buyer-2',
    name: 'Lerato Ndlovu',
    email: 'lerato.buyer@hazyeats.demo',
    role: 'buyer',
    phone: '071 456 7812',
    vehicle: '',
    storeName: '',
  },
  {
    uid: 'demo-buyer-3',
    name: 'Bongani Sithole',
    email: 'bongani.buyer@hazyeats.demo',
    role: 'buyer',
    phone: '082 334 9011',
    vehicle: '',
    storeName: '',
  },
  {
    uid: 'demo-buyer-4',
    name: 'Nomsa Khoza',
    email: 'nomsa.buyer@hazyeats.demo',
    role: 'buyer',
    phone: '076 891 2240',
    vehicle: '',
    storeName: '',
  },
  {
    uid: 'demo-buyer-5',
    name: 'Sibusiso Nkosi',
    email: 'sibusiso.buyer@hazyeats.demo',
    role: 'buyer',
    phone: '079 612 4480',
    vehicle: '',
    storeName: '',
  },

  // Drivers (4)
  {
    uid: 'demo-driver-1',
    name: 'Sipho Driver',
    email: 'driver@hazyeats.demo',
    role: 'driver',
    phone: '072 987 6543',
    vehicle: 'Honda 125cc Bike - MP 214 GP',
    storeName: '',
  },
  {
    uid: 'demo-driver-2',
    name: 'Mandla Mnisi',
    email: 'mandla.driver@hazyeats.demo',
    role: 'driver',
    phone: '073 552 1904',
    vehicle: 'Yamaha Crux 110cc - MP 509 GP',
    storeName: '',
  },
  {
    uid: 'demo-driver-3',
    name: 'Kabelo Chauke',
    email: 'kabelo.driver@hazyeats.demo',
    role: 'driver',
    phone: '083 418 7732',
    vehicle: 'VW Polo Vivo - MP 778 GP',
    storeName: '',
  },
  {
    uid: 'demo-driver-4',
    name: 'Zanele Mabaso',
    email: 'zanele.driver@hazyeats.demo',
    role: 'driver',
    phone: '074 881 3025',
    vehicle: 'Suzuki Swift - MP 331 GP',
    storeName: '',
  },

  // Restaurants & Partner Stores (16)
  {
    uid: 'demo-store-1',
    name: 'KFC Hazyview Manager',
    email: 'store@hazyeats.demo',
    role: 'store',
    phone: '013 737 0001',
    vehicle: '',
    storeName: 'KFC',
  },
  {
    uid: 'demo-store-debonairs',
    name: 'Debonairs Pizza Manager',
    email: 'debonairs@hazyeats.demo',
    role: 'store',
    phone: '013 737 0002',
    vehicle: '',
    storeName: 'Debonairs Pizza',
  },
  {
    uid: 'demo-store-mcdonalds',
    name: "McDonald's Hazyview Manager",
    email: 'mcdonalds@hazyeats.demo',
    role: 'store',
    phone: '013 737 0003',
    vehicle: '',
    storeName: "McDonald's",
  },
  {
    uid: 'demo-store-romans',
    name: "Roman's Pizza Manager",
    email: 'romans@hazyeats.demo',
    role: 'store',
    phone: '013 737 0004',
    vehicle: '',
    storeName: "Roman's Pizza",
  },
  {
    uid: 'demo-store-spur',
    name: 'Spur Hazyview Manager',
    email: 'spur@hazyeats.demo',
    role: 'store',
    phone: '013 737 0005',
    vehicle: '',
    storeName: 'Spur',
  },
  {
    uid: 'demo-store-steers',
    name: 'Steers Hazyview Manager',
    email: 'steers@hazyeats.demo',
    role: 'store',
    phone: '013 737 0006',
    vehicle: '',
    storeName: 'Steers',
  },
  {
    uid: 'demo-store-chickenlicken',
    name: 'Chicken Licken Manager',
    email: 'chickenlicken@hazyeats.demo',
    role: 'store',
    phone: '013 737 0007',
    vehicle: '',
    storeName: 'Chicken Licken',
  },
  {
    uid: 'demo-store-burgerking',
    name: 'Burger King Hazyview Manager',
    email: 'burgerking@hazyeats.demo',
    role: 'store',
    phone: '013 737 0008',
    vehicle: '',
    storeName: 'Burger King',
  },
  {
    uid: 'demo-store-spar',
    name: 'Spar Hazyview Deli Manager',
    email: 'spar@hazyeats.demo',
    role: 'store',
    phone: '013 737 0009',
    vehicle: '',
    storeName: 'Spar Hazyview',
  },
  {
    uid: 'demo-store-wimpy',
    name: 'Wimpy Hazyview Manager',
    email: 'wimpy@hazyeats.demo',
    role: 'store',
    phone: '013 737 0010',
    vehicle: '',
    storeName: 'Wimpy',
  },
  {
    uid: 'demo-store-woolworths',
    name: 'Woolworths Food Manager',
    email: 'woolworths@hazyeats.demo',
    role: 'store',
    phone: '013 737 0011',
    vehicle: '',
    storeName: 'Woolworths Food',
  },
  {
    uid: 'demo-store-oceanbasket',
    name: 'Ocean Basket Hazyview Manager',
    email: 'oceanbasket@hazyeats.demo',
    role: 'store',
    phone: '013 737 0012',
    vehicle: '',
    storeName: 'Ocean Basket',
  },
  {
    uid: 'demo-store-pioneers',
    name: 'Pioneers Grill Manager',
    email: 'pioneers@hazyeats.demo',
    role: 'store',
    phone: '013 737 0013',
    vehicle: '',
    storeName: 'Pioneers Grill',
  },
  {
    uid: 'demo-store-kuka',
    name: 'Kuka Cafe Manager',
    email: 'kuka@hazyeats.demo',
    role: 'store',
    phone: '013 737 0014',
    vehicle: '',
    storeName: 'Kuka Cafe',
  },
  {
    uid: 'demo-store-zakheles',
    name: 'Zakhele Mhlongo',
    email: 'zakheles@hazyeats.demo',
    role: 'store',
    phone: '078 441 9210',
    vehicle: '',
    storeName: "Zakhele's Kota & Chips",
  },
  {
    uid: 'demo-store-mamazodwa',
    name: 'Mama Zodwa',
    email: 'mamazodwa@hazyeats.demo',
    role: 'store',
    phone: '072 309 1145',
    vehicle: '',
    storeName: "Mama Zodwa's Kitchen",
  },

  // Admin (1)
  {
    uid: 'demo-admin-1',
    name: 'ZikCode System Admin',
    email: 'admin@hazyeats.demo',
    role: 'admin',
    phone: '013 737 0000',
    vehicle: '',
    storeName: '',
  },
];

export const PROTOTYPE_DRIVER_PROFILES_SEED: PrototypeDriverProfileSeed[] = [
  {
    id: 'DRV-SEED-001',
    userEmail: 'driver@hazyeats.demo',
    firstName: 'Sipho',
    lastName: 'Driver',
    email: 'driver@hazyeats.demo',
    phone: '(072) 987-6543',
    streetAddress: 'Stand 118, Shabalala Trust',
    streetAddressLine2: 'Near Main Taxi Rank',
    city: 'Hazyview',
    stateProvince: 'Mpumalanga',
    postalCode: '1242',
    dateOfBirth: '04-15-1996',
    emergencyContactName: 'Gogo Mavis (Mother)',
    emergencyContactPhone: '(071) 442-8810',
    preferredArea: 'Hazyview CBD & Shabalala Trust',
    vehicleType: 'Motorbike (Honda 125cc)',
    driversLicenseType: 'Code A1 (Light Motorcycle)',
    availability: 'Mon–Sun, 08:00–21:00',
    hasPriorExperience: true,
  },
  {
    id: 'DRV-SEED-002',
    userEmail: 'mandla.driver@hazyeats.demo',
    firstName: 'Mandla',
    lastName: 'Mnisi',
    email: 'mandla.driver@hazyeats.demo',
    phone: '(073) 552-1904',
    streetAddress: 'House 204, Marite Road',
    streetAddressLine2: '',
    city: 'Hazyview',
    stateProvince: 'Mpumalanga',
    postalCode: '1242',
    dateOfBirth: '09-22-1994',
    emergencyContactName: 'Thembi Mnisi (Sister)',
    emergencyContactPhone: '(079) 310-4421',
    preferredArea: 'Hazyview Junction & Blue Haze Mall',
    vehicleType: 'Motorbike (Yamaha Crux 110cc)',
    driversLicenseType: 'Code A (Motorcycle)',
    availability: 'Mon–Sat, 09:00–20:00',
    hasPriorExperience: true,
  },
  {
    id: 'DRV-SEED-003',
    userEmail: 'kabelo.driver@hazyeats.demo',
    firstName: 'Kabelo',
    lastName: 'Chauke',
    email: 'kabelo.driver@hazyeats.demo',
    phone: '(083) 418-7732',
    streetAddress: '45 Kruger Gate Avenue',
    streetAddressLine2: 'Unit 2',
    city: 'Hazyview',
    stateProvince: 'Mpumalanga',
    postalCode: '1242',
    dateOfBirth: '11-08-1992',
    emergencyContactName: 'Palesa Chauke (Spouse)',
    emergencyContactPhone: '(082) 912-3044',
    preferredArea: 'Hazyview, Shabalala & Perry’s Bridge',
    vehicleType: 'Hatchback Car (VW Polo Vivo)',
    driversLicenseType: 'Code B (Light Motor Vehicle)',
    availability: 'Tue–Sun, 10:00–22:00',
    hasPriorExperience: true,
  },
  {
    id: 'DRV-SEED-004',
    userEmail: 'zanele.driver@hazyeats.demo',
    firstName: 'Zanele',
    lastName: 'Mabaso',
    email: 'zanele.driver@hazyeats.demo',
    phone: '(074) 881-3025',
    streetAddress: 'Stand 89, Phola Park',
    streetAddressLine2: '',
    city: 'Hazyview',
    stateProvince: 'Mpumalanga',
    postalCode: '1242',
    dateOfBirth: '02-19-1998',
    emergencyContactName: 'Dumisani Mabaso (Brother)',
    emergencyContactPhone: '(076) 224-1198',
    preferredArea: 'Shabalala Trust & Hazyview Mall',
    vehicleType: 'Compact Car (Suzuki Swift)',
    driversLicenseType: 'Code EB (Light Motor Vehicle + Trailer)',
    availability: 'Fri–Sun & Weekdays 16:00–21:30',
    hasPriorExperience: false,
  },
];
