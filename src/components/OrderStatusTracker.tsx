import { Bike, Check, CheckCircle2, ChefHat, PackageCheck } from 'lucide-react';
import type { OrderDTO } from '../types.ts';
import { getOrderTrackingState, type OrderTrackingStep } from '../utils/orders.ts';

interface OrderStatusTrackerProps {
  order: OrderDTO;
}

function StepIcon({
  stepKey,
  status,
}: {
  stepKey: OrderTrackingStep['key'];
  status: OrderTrackingStep['status'];
}) {
  if (status === 'completed' && stepKey !== 'delivered') {
    return <Check size={16} strokeWidth={2.75} aria-hidden="true" />;
  }

  switch (stepKey) {
    case 'preparing':
      return <ChefHat size={16} strokeWidth={2} aria-hidden="true" />;
    case 'ready':
      return <PackageCheck size={16} strokeWidth={2} aria-hidden="true" />;
    case 'out_for_delivery':
      return <Bike size={16} strokeWidth={2} aria-hidden="true" />;
    case 'delivered':
      return <CheckCircle2 size={16} strokeWidth={2.25} aria-hidden="true" />;
  }
}

export function OrderStatusTracker({ order }: OrderStatusTrackerProps) {
  const tracking = getOrderTrackingState(order);
  const currentStep = tracking.steps[tracking.activeStepIndex];

  return (
    <section
      className="order-tracker"
      aria-label={`Order ${order.id} progress`}
      data-testid={`order-tracker-${order.id}`}
      data-active-step={currentStep.key}
      data-progress-percent={tracking.progressPercent}
    >
      <div className="order-tracker-header">
        <span className="order-tracker-stage-text">
          {tracking.isDelivered
            ? 'Order Completed'
            : `Current Stage: ${currentStep.label}`}
        </span>
        <span className="order-tracker-percent">
          {tracking.isDelivered
            ? '100% Complete'
            : `Step ${tracking.activeStepIndex + 1} of ${tracking.steps.length}`}
        </span>
      </div>

      <div className="order-stepper-wrap">
        <div className="order-stepper-rail" aria-hidden="true">
          <div
            className="order-stepper-rail-fill"
            style={{ width: `${tracking.progressPercent}%` }}
          />
        </div>

        <ol className="order-stepper">
          {tracking.steps.map((step) => (
            <li
              key={step.key}
              className={`order-step order-step-${step.status}`}
              aria-current={step.status === 'active' ? 'step' : undefined}
            >
              <div className="order-step-node">
                <StepIcon stepKey={step.key} status={step.status} />
              </div>
              <div className="order-step-meta">
                <span className="order-step-label">{step.label}</span>
                <span className="order-step-desc">{step.description}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="order-tracker-details">
        {tracking.storeBreakdown.length > 0 && (
          <div className="order-store-readiness" aria-label="Store preparation status">
            {tracking.storeBreakdown.map((store) => (
              <span
                key={store.storeName}
                className={`order-store-chip ${
                  store.prepStatus === 'Ready'
                    ? 'order-store-chip-ready'
                    : store.prepStatus === 'Preparing'
                    ? 'order-store-chip-prep'
                    : 'order-store-chip-received'
                }`}
              >
                {store.prepStatus === 'Ready'
                  ? '✓'
                  : store.prepStatus === 'Preparing'
                  ? '⏳'
                  : '•'}{' '}
                {store.storeName}: {store.prepStatus}
              </span>
            ))}
          </div>
        )}

        <div className="order-tracker-summary">
          {tracking.activeStepIndex === 0 && (
            <span>
              {tracking.readyStoreCount} of {tracking.totalStoreCount} store
              {tracking.totalStoreCount === 1 ? '' : 's'} ready — driver pickup unlocks once all
              stores are ready
            </span>
          )}
          {tracking.activeStepIndex === 1 && (
            <span>All stores packed &amp; ready — waiting for driver acceptance</span>
          )}
          {tracking.activeStepIndex === 2 && (
            <span>
              Driver <strong>{order.driverName || 'Assigned'}</strong> is en route to{' '}
              {order.address}
            </span>
          )}
          {tracking.activeStepIndex === 3 && (
            <span>
              Delivered to {order.address}
              {order.driverName ? ` by ${order.driverName}` : ''}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
