import type { DriverDocumentInput, DriverOnboardingPayload } from '../types.ts';
import { validateEmail } from './marketplace.ts';

export const DRIVERS_LICENSE_TYPES = [
  'Code A (Motorcycle > 125cc)',
  'Code A1 (Light Motorcycle <= 125cc)',
  'Code B (Light Motor Vehicle)',
  'Code EB (Light Motor Vehicle + Trailer)',
  'Code C1 / C (Heavy Motor Vehicle)',
  "Learner's License",
  'None (Bicycle / E-Bike Only)',
] as const;

export const VEHICLE_TYPES = [
  'Motorbike / Scooter',
  'Car / Sedan / Hatchback',
  'Bakkie / Delivery Van',
  'Bicycle / E-Bike',
] as const;

export const ALLOWED_DOC_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const MAX_DOC_BYTES = 2 * 1024 * 1024;
export const MAX_DOC_COUNT = 5;

export function formatPhoneMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidFormattedPhone(phone: string): boolean {
  return /^\(\d{3}\)\s\d{3}-\d{4}$/.test(phone.trim());
}

export function formatDobMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

export function isValidBirthDateMmDdYyyy(value: string): boolean {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return false;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const currentYear = new Date().getFullYear();
  if (year < 1920 || year > currentYear - 16) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidSignatureDataUrl(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.startsWith('data:image/png;base64,') &&
    trimmed.length > 'data:image/png;base64,'.length + 32 &&
    trimmed.length <= 500_000
  );
}

export function validateDocumentFile(doc: DriverDocumentInput): string | null {
  if (!doc.fileName.trim()) {
    return 'Document file name is required.';
  }
  if (!ALLOWED_DOC_MIME_TYPES.includes(doc.mimeType as (typeof ALLOWED_DOC_MIME_TYPES)[number])) {
    return `Unsupported file type for ${doc.fileName}. Allowed: PDF, PNG, JPG, WEBP.`;
  }
  if (!Number.isFinite(doc.sizeBytes) || doc.sizeBytes <= 0 || doc.sizeBytes > MAX_DOC_BYTES) {
    return `${doc.fileName} exceeds the 2 MB limit.`;
  }
  if (!doc.dataBase64 || doc.dataBase64.length > 3_000_000) {
    return `Invalid document payload for ${doc.fileName}.`;
  }
  return null;
}

export function validateDriverOnboarding(
  payload: DriverOnboardingPayload
): { valid: true } | { valid: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!payload.firstName.trim()) {
    errors.firstName = 'This field is required.';
  }
  if (!payload.lastName.trim()) {
    errors.lastName = 'This field is required.';
  }
  if (!validateEmail(payload.email)) {
    errors.email = 'Please enter a valid email address (example@example.com).';
  }
  if (!isValidFormattedPhone(payload.phone)) {
    errors.phone = 'Please enter a valid phone number. Format: (000) 000-0000.';
  }
  if (!payload.streetAddress.trim()) {
    errors.streetAddress = 'This field is required.';
  }
  if (!payload.city.trim()) {
    errors.city = 'This field is required.';
  }
  if (!payload.stateProvince.trim()) {
    errors.stateProvince = 'This field is required.';
  }
  if (!payload.postalCode.trim()) {
    errors.postalCode = 'This field is required.';
  }
  if (!isValidBirthDateMmDdYyyy(payload.dateOfBirth)) {
    errors.dateOfBirth = 'Please enter a valid date (MM-DD-YYYY).';
  }
  if (!payload.emergencyContactName.trim()) {
    errors.emergencyContactName = 'This field is required.';
  }
  if (!isValidFormattedPhone(payload.emergencyContactPhone)) {
    errors.emergencyContactPhone =
      'Please enter a valid phone number. Format: (000) 000-0000.';
  }
  if (!payload.preferredArea.trim()) {
    errors.preferredArea = 'This field is required.';
  }
  if (!payload.vehicleType.trim()) {
    errors.vehicleType = 'This field is required.';
  }
  if (!payload.driversLicenseType.trim()) {
    errors.driversLicenseType = 'This field is required.';
  }
  if (!payload.availability.trim()) {
    errors.availability = 'This field is required.';
  }
  if (payload.hasPriorExperience === null) {
    errors.hasPriorExperience = 'This field is required.';
  }

  if (payload.documents.length > MAX_DOC_COUNT) {
    errors.documents = `You can upload at most ${MAX_DOC_COUNT} documents.`;
  } else {
    for (const doc of payload.documents) {
      const docErr = validateDocumentFile(doc);
      if (docErr) {
        errors.documents = docErr;
        break;
      }
    }
  }

  if (!isValidSignatureDataUrl(payload.signatureDataUrl)) {
    errors.signature = 'Signature is required. Please sign to confirm your application.';
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
}
