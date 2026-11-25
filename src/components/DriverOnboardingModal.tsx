import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type PointerEvent } from 'react';
import { submitDriverApplication } from '../services/api.ts';
import type {
  DriverApplicationDTO,
  DriverDocumentInput,
  UserProfile,
} from '../types.ts';
import {
  ALLOWED_DOC_MIME_TYPES,
  DRIVERS_LICENSE_TYPES,
  MAX_DOC_BYTES,
  MAX_DOC_COUNT,
  VEHICLE_TYPES,
  formatDobMask,
  formatPhoneMask,
  validateDriverOnboarding,
} from '../utils/driverOnboarding.ts';

interface DriverOnboardingModalProps {
  open: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onSubmitted: (application: DriverApplicationDTO) => void;
  onProceedToSignUp: (prefill: { name: string; email: string; phone: string; vehicle: string }) => void;
}

export function DriverOnboardingModal({
  open,
  user,
  onClose,
  onSubmitted,
  onProceedToSignUp,
}: DriverOnboardingModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [streetAddressLine2, setStreetAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateProvince, setStateProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [preferredArea, setPreferredArea] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [driversLicenseType, setDriversLicenseType] = useState('');
  const [availability, setAvailability] = useState('');
  const [hasPriorExperience, setHasPriorExperience] = useState<boolean | null>(null);
  const [documents, setDocuments] = useState<DriverDocumentInput[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedApp, setSubmittedApp] = useState<DriverApplicationDTO | null>(null);

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    setServerError(null);
    if (user && !email) {
      const parts = user.name.trim().split(/\s+/);
      if (!firstName && parts[0]) setFirstName(parts[0]);
      if (!lastName && parts.length > 1) setLastName(parts.slice(1).join(' '));
      setEmail(user.email);
      if (user.phone && !phone) {
        const masked = formatPhoneMask(user.phone);
        if (masked.length === 14) setPhone(masked);
      }
      if (user.vehicle && !vehicleType) setVehicleType(user.vehicle);
    }
  }, [open, user]);

  useEffect(() => {
    if (!open || submittedApp) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#fcf6ba';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [open, submittedApp]);

  if (!open) return null;

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const getCanvasPoint = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const pt = getCanvasPoint(e);
    drawingRef.current = true;
    ctx.strokeStyle = '#fcf6ba';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.lineTo(pt.x + 0.1, pt.y + 0.1);
    ctx.stroke();
    setHasDrawnSignature(true);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.signature;
      return next;
    });
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasDrawnSignature) {
      setSignatureDataUrl(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawnSignature(false);
    setSignatureDataUrl('');
  };

  const readFileAsBase64 = (file: File): Promise<DriverDocumentInput> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          dataBase64: base64,
        });
      };
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.documents;
      return next;
    });

    const incoming = Array.from(files);
    if (documents.length + incoming.length > MAX_DOC_COUNT) {
      setFieldErrors((prev) => ({
        ...prev,
        documents: `You can upload at most ${MAX_DOC_COUNT} documents.`,
      }));
      return;
    }

    const added: DriverDocumentInput[] = [];
    for (const file of incoming) {
      if (
        !ALLOWED_DOC_MIME_TYPES.includes(
          file.type as (typeof ALLOWED_DOC_MIME_TYPES)[number]
        )
      ) {
        setFieldErrors((prev) => ({
          ...prev,
          documents: `Unsupported file type for ${file.name}. Allowed: PDF, PNG, JPG, WEBP.`,
        }));
        return;
      }
      if (file.size <= 0 || file.size > MAX_DOC_BYTES) {
        setFieldErrors((prev) => ({
          ...prev,
          documents: `${file.name} must be under 2 MB.`,
        }));
        return;
      }
      added.push(await readFileAsBase64(file));
    }

    setDocuments((prev) => [...prev, ...added]);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    void handleFilesSelected(e.dataTransfer.files);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const currentSig =
      hasDrawnSignature && canvasRef.current
        ? canvasRef.current.toDataURL('image/png')
        : signatureDataUrl;

    const payload = {
      firstName,
      lastName,
      email,
      phone,
      streetAddress,
      streetAddressLine2,
      city,
      stateProvince,
      postalCode,
      dateOfBirth,
      emergencyContactName,
      emergencyContactPhone,
      preferredArea,
      vehicleType,
      driversLicenseType,
      availability,
      hasPriorExperience,
      documents,
      signatureDataUrl: currentSig,
    };

    const validation = validateDriverOnboarding(payload);
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const created = await submitDriverApplication(payload);
      setSubmittedApp(created);
      onSubmitted(created);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Failed to submit application.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setSubmittedApp(null);
    onClose();
  };

  return (
    <div
      id="driver-onboarding-modal"
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="driver-onboarding-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) resetAndClose();
      }}
    >
      <div className="modal" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <div>
            <h2 id="driver-onboarding-title">
              Food Delivery Personnel <span className="gold-text">Onboarding Form</span>
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '4px' }}>
              Please complete this form to begin your onboarding process as a food delivery
              personnel.
            </p>
          </div>
          <button
            type="button"
            className="close-btn"
            aria-label="Close driver onboarding form"
            onClick={resetAndClose}
          >
            &times;
          </button>
        </div>

        {submittedApp ? (
          <div style={{ padding: '12px 0' }}>
            <div className="form-success">
              <strong>Application Submitted!</strong> Reference ID:{' '}
              <code>{submittedApp.id}</code>
            </div>
            <div className="order-card">
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                {submittedApp.firstName} {submittedApp.lastName}
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Vehicle: {submittedApp.vehicleType} • License: {submittedApp.driversLicenseType}
                <br />
                Preferred Area: {submittedApp.preferredArea} • Status:{' '}
                <span className="badge badge-pending">{submittedApp.status}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
              {!user && (
                <button
                  type="button"
                  className="btn-gold"
                  onClick={() => {
                    const prefill = {
                      name: `${submittedApp.firstName} ${submittedApp.lastName}`.trim(),
                      email: submittedApp.email,
                      phone: submittedApp.phone,
                      vehicle: `${submittedApp.vehicleType} (${submittedApp.driversLicenseType})`,
                    };
                    setSubmittedApp(null);
                    onClose();
                    onProceedToSignUp(prefill);
                  }}
                >
                  Create Driver Account Now
                </button>
              )}
              <button type="button" className="btn-outline" onClick={resetAndClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {serverError && <div className="form-error">{serverError}</div>}

            {/* Full Name */}
            <div className="form-group">
              <label htmlFor="drv-first-name">Full Name*</label>
              <div className="form-row-2">
                <div>
                  <input
                    type="text"
                    id="drv-first-name"
                    aria-label="First Name"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      clearFieldError('firstName');
                    }}
                  />
                  <span className="sub-label">First Name</span>
                  {fieldErrors.firstName && (
                    <div className="field-error">{fieldErrors.firstName}</div>
                  )}
                </div>
                <div>
                  <input
                    type="text"
                    id="drv-last-name"
                    aria-label="Last Name"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      clearFieldError('lastName');
                    }}
                  />
                  <span className="sub-label">Last Name</span>
                  {fieldErrors.lastName && (
                    <div className="field-error">{fieldErrors.lastName}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Email Address */}
            <div className="form-group">
              <label htmlFor="drv-email">Email Address*</label>
              <input
                type="email"
                id="drv-email"
                placeholder="example@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError('email');
                }}
              />
              {fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
            </div>

            {/* Phone Number */}
            <div className="form-group">
              <label htmlFor="drv-phone">Phone Number*</label>
              <input
                type="tel"
                id="drv-phone"
                placeholder="(000) 000-0000"
                value={phone}
                onChange={(e) => {
                  setPhone(formatPhoneMask(e.target.value));
                  clearFieldError('phone');
                }}
              />
              <span className="sub-label">Format: (000) 000-0000.</span>
              {fieldErrors.phone && <div className="field-error">{fieldErrors.phone}</div>}
            </div>

            {/* Residential Address */}
            <div className="form-group">
              <label htmlFor="drv-street">Residential Address*</label>
              <div style={{ marginBottom: '10px' }}>
                <input
                  type="text"
                  id="drv-street"
                  aria-label="Street Address"
                  placeholder="Street Address"
                  value={streetAddress}
                  onChange={(e) => {
                    setStreetAddress(e.target.value);
                    clearFieldError('streetAddress');
                  }}
                />
                <span className="sub-label">Street Address</span>
                {fieldErrors.streetAddress && (
                  <div className="field-error">{fieldErrors.streetAddress}</div>
                )}
              </div>

              <div style={{ marginBottom: '10px' }}>
                <input
                  type="text"
                  id="drv-street2"
                  aria-label="Street Address Line 2"
                  placeholder="Street Address Line 2"
                  value={streetAddressLine2}
                  onChange={(e) => setStreetAddressLine2(e.target.value)}
                />
                <span className="sub-label">Street Address Line 2</span>
              </div>

              <div className="form-row-2" style={{ marginBottom: '10px' }}>
                <div>
                  <input
                    type="text"
                    id="drv-city"
                    aria-label="City"
                    placeholder="City"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      clearFieldError('city');
                    }}
                  />
                  <span className="sub-label">City</span>
                  {fieldErrors.city && <div className="field-error">{fieldErrors.city}</div>}
                </div>
                <div>
                  <input
                    type="text"
                    id="drv-state"
                    aria-label="State / Province"
                    placeholder="State / Province"
                    value={stateProvince}
                    onChange={(e) => {
                      setStateProvince(e.target.value);
                      clearFieldError('stateProvince');
                    }}
                  />
                  <span className="sub-label">State / Province</span>
                  {fieldErrors.stateProvince && (
                    <div className="field-error">{fieldErrors.stateProvince}</div>
                  )}
                </div>
              </div>

              <div>
                <input
                  type="text"
                  id="drv-postal"
                  aria-label="Postal / Zip Code"
                  placeholder="Postal / Zip Code"
                  value={postalCode}
                  onChange={(e) => {
                    setPostalCode(e.target.value);
                    clearFieldError('postalCode');
                  }}
                />
                <span className="sub-label">Postal / Zip Code</span>
                {fieldErrors.postalCode && (
                  <div className="field-error">{fieldErrors.postalCode}</div>
                )}
              </div>
            </div>

            {/* Date of Birth */}
            <div className="form-group">
              <label htmlFor="drv-dob">Date of Birth*</label>
              <input
                type="text"
                id="drv-dob"
                placeholder="MM-DD-YYYY"
                value={dateOfBirth}
                onChange={(e) => {
                  setDateOfBirth(formatDobMask(e.target.value));
                  clearFieldError('dateOfBirth');
                }}
              />
              <span className="sub-label">2 digit month, 2 digit day, 4 digit year</span>
              {fieldErrors.dateOfBirth && (
                <div className="field-error">{fieldErrors.dateOfBirth}</div>
              )}
            </div>

            {/* Emergency Contact */}
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="drv-emergency-name">
                  Emergency Contact Name and Relationship*
                </label>
                <input
                  type="text"
                  id="drv-emergency-name"
                  placeholder="e.g. Thandi Dlamini (Sister)"
                  value={emergencyContactName}
                  onChange={(e) => {
                    setEmergencyContactName(e.target.value);
                    clearFieldError('emergencyContactName');
                  }}
                />
                {fieldErrors.emergencyContactName && (
                  <div className="field-error">{fieldErrors.emergencyContactName}</div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="drv-emergency-phone">Emergency Contact Phone Number*</label>
                <input
                  type="tel"
                  id="drv-emergency-phone"
                  placeholder="(000) 000-0000"
                  value={emergencyContactPhone}
                  onChange={(e) => {
                    setEmergencyContactPhone(formatPhoneMask(e.target.value));
                    clearFieldError('emergencyContactPhone');
                  }}
                />
                <span className="sub-label">Format: (000) 000-0000.</span>
                {fieldErrors.emergencyContactPhone && (
                  <div className="field-error">{fieldErrors.emergencyContactPhone}</div>
                )}
              </div>
            </div>

            {/* Preferred Delivery Area */}
            <div className="form-group">
              <label htmlFor="drv-area">Preferred Delivery Area or City*</label>
              <input
                type="text"
                id="drv-area"
                placeholder="e.g. Shabalala Trust & Hazyview"
                value={preferredArea}
                onChange={(e) => {
                  setPreferredArea(e.target.value);
                  clearFieldError('preferredArea');
                }}
              />
              {fieldErrors.preferredArea && (
                <div className="field-error">{fieldErrors.preferredArea}</div>
              )}
            </div>

            {/* Vehicle Type & Driver's License Type */}
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="drv-vehicle">
                  Type of Vehicle You Will Use for Deliveries*
                </label>
                <select
                  id="drv-vehicle"
                  value={vehicleType}
                  onChange={(e) => {
                    setVehicleType(e.target.value);
                    clearFieldError('vehicleType');
                  }}
                >
                  <option value="">Select vehicle type</option>
                  {VEHICLE_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                {fieldErrors.vehicleType && (
                  <div className="field-error">{fieldErrors.vehicleType}</div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="drv-license-type">Driver&apos;s License Type*</label>
                <select
                  id="drv-license-type"
                  value={driversLicenseType}
                  onChange={(e) => {
                    setDriversLicenseType(e.target.value);
                    clearFieldError('driversLicenseType');
                  }}
                >
                  <option value="">Select driver&apos;s license type</option>
                  {DRIVERS_LICENSE_TYPES.map((lt) => (
                    <option key={lt} value={lt}>
                      {lt}
                    </option>
                  ))}
                </select>
                {fieldErrors.driversLicenseType && (
                  <div className="field-error">{fieldErrors.driversLicenseType}</div>
                )}
              </div>
            </div>

            {/* Days and Times Available */}
            <div className="form-group">
              <label htmlFor="drv-availability">Days and Times Available for Work*</label>
              <input
                type="text"
                id="drv-availability"
                placeholder="e.g. Monday–Sunday, 08:00–20:00"
                value={availability}
                onChange={(e) => {
                  setAvailability(e.target.value);
                  clearFieldError('availability');
                }}
              />
              {fieldErrors.availability && (
                <div className="field-error">{fieldErrors.availability}</div>
              )}
            </div>

            {/* Prior Experience */}
            <div className="form-group">
              <span
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '8px',
                }}
              >
                Do you have prior experience in food delivery?*
              </span>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: 0,
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="drv-experience"
                    value="yes"
                    checked={hasPriorExperience === true}
                    onChange={() => {
                      setHasPriorExperience(true);
                      clearFieldError('hasPriorExperience');
                    }}
                    style={{ width: 'auto' }}
                  />
                  Yes
                </label>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: 0,
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="drv-experience"
                    value="no"
                    checked={hasPriorExperience === false}
                    onChange={() => {
                      setHasPriorExperience(false);
                      clearFieldError('hasPriorExperience');
                    }}
                    style={{ width: 'auto' }}
                  />
                  No
                </label>
              </div>
              {fieldErrors.hasPriorExperience && (
                <div className="field-error">{fieldErrors.hasPriorExperience}</div>
              )}
            </div>

            {/* Document Upload */}
            <div className="form-group">
              <label htmlFor="drv-documents">
                Please upload any relevant documents (e.g., proof of insurance, background
                check, or other certifications)
              </label>
              <div
                className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  id="drv-documents"
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  style={{ display: 'none' }}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    void handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="btn-outline"
                  style={{ marginBottom: '8px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload a File
                </button>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Drag and drop files here (PDF, PNG, JPG, WEBP • max 2 MB each)
                </div>
                <div style={{ fontSize: '0.8rem', color: '#71717a', marginTop: '6px' }}>
                  {documents.length === 0
                    ? 'No file chosen'
                    : `${documents.length} file(s) attached`}
                </div>
              </div>

              {documents.length > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {documents.map((doc, idx) => (
                    <div
                      key={`${doc.fileName}-${idx}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        background: '#09090b',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                      }}
                    >
                      <span>
                        {doc.fileName} ({Math.max(1, Math.round(doc.sizeBytes / 1024))} KB)
                      </span>
                      <button
                        type="button"
                        className="btn-outline"
                        style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                        onClick={() =>
                          setDocuments((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {fieldErrors.documents && (
                <div className="field-error">{fieldErrors.documents}</div>
              )}
            </div>

            {/* Signature Pad */}
            <div className="form-group">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <label htmlFor="drv-signature-pad" style={{ margin: 0 }}>
                  Signature (Please sign to confirm your application)*
                </label>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  onClick={clearSignature}
                >
                  Clear
                </button>
              </div>
              <div className="signature-pad-wrap">
                <canvas
                  id="drv-signature-pad"
                  ref={canvasRef}
                  width={600}
                  height={140}
                  className="signature-canvas"
                  aria-label="Signature pad"
                  data-testid="signature-canvas"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                />
              </div>
              <span className="sub-label">
                Draw your signature above with mouse or touch.
              </span>
              {fieldErrors.signature && (
                <div className="field-error">{fieldErrors.signature}</div>
              )}
            </div>

            <button
              type="submit"
              className="btn-gold"
              style={{ width: '100%' }}
              disabled={submitting}
            >
              {submitting ? 'Submitting Application...' : 'Submit Application'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
