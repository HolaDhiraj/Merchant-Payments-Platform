import { useCallback, useState } from 'react';
import { ApiError } from '@/api/http';
import { useCheckout, useMerchantProfile } from '@/api/portalQueries';
import type { CheckoutInput, Customer, Merchant, Payment, PaymentMethod } from '@/api/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageLoader } from '@/components/ui/Spinner';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatMoney, toMinorUnits } from '@/lib/format';
import { CustomerSection, EMPTY_CUSTOMER, maxPoints, normalisePhone, phoneLooksComplete, type CustomerDraft } from './CustomerSection';
import { detailErrors, EMPTY_DETAILS, isAccepted, parseExpiry, PaymentMethodForm, type PaymentDetails } from './PaymentMethodForm';
import { ConfirmChargeDialog, type ChargeSummary } from './ConfirmChargeDialog';
import { ProductPicker } from './ProductPicker';
import { ReceiptDialog } from './ReceiptDialog';
import { MAX_QUANTITY, useCart } from './useCart';
import styles from './Checkout.module.css';

const newAttemptKey = () => `pos-${crypto.randomUUID()}`;

export function CheckoutPage() {
  const profile = useMerchantProfile();
  if (profile.isPending) return <PageLoader label="Opening the till" />;
  if (profile.isError) return <Callout tone="danger">{errorMessage(profile.error)}</Callout>;
  return <Till merchant={profile.data} />;
}

function Till({ merchant }: { merchant: Merchant }) {
  const cart = useCart();
  const checkout = useCheckout();
  const [method, setMethod] = useState<PaymentMethod>(() =>
    (['CASH', 'CARD', 'BANK_TRANSFER'] as PaymentMethod[]).find((m) => isAccepted(merchant, m)) ?? 'CASH',
  );
  const [details, setDetails] = useState<PaymentDetails>(EMPTY_DETAILS);
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>(EMPTY_CUSTOMER);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  // Nothing is charged until the cashier confirms this summary.
  const [confirming, setConfirming] = useState<ChargeSummary | null>(null);
  // One key per payment attempt: kept when a request gets no answer (so a retry replays it
  // instead of charging twice), replaced once the server has answered.
  const [attemptKey, setAttemptKey] = useState(newAttemptKey);

  const onResolved = useCallback((found: Customer | null) => setCustomer(found), []);
  const pointsLimit = maxPoints(customer, merchant, cart.totals.afterDiscount);
  const points = Math.min(customerDraft.points, pointsLimit);
  const pointsValue = points * merchant.loyalty.pointValueMinor;
  const total = cart.totals.afterDiscount - pointsValue;
  const money = (minor: number) => formatMoney(minor, merchant.currency);

  const phoneGiven = phoneLooksComplete(customerDraft.phone);
  const needsName = phoneGiven && !customer && customerDraft.fullName.trim().length < 2;
  const customerMissing = method === 'CASH' && !phoneGiven;
  const blocked =
    cart.lines.length === 0 ||
    customerMissing ||
    needsName ||
    Object.keys(detailErrors(method, details, total, merchant.currency)).length > 0;

  function buildInput(): CheckoutInput {
    const input: CheckoutInput = {
      items: cart.lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
      method,
    };
    if (phoneGiven) {
      input.customer = { phone: normalisePhone(customerDraft.phone), ...(customer ? {} : { fullName: customerDraft.fullName.trim() }) };
      if (points > 0) input.pointsToRedeem = points;
    }
    if (method === 'CASH') input.cashTenderedMinor = toMinorUnits(details.tendered, merchant.currency) ?? 0;
    if (method === 'CARD') {
      const expiry = parseExpiry(details.cardExpiry)!;
      input.card = {
        number: details.cardNumber,
        expiryMonth: expiry.month,
        expiryYear: expiry.year,
        cvv: details.cardCvv,
        holderName: details.cardHolder.trim(),
      };
    }
    if (method === 'BANK_TRANSFER') input.bankTransfer = { accountNumber: details.accountNumber, pin: details.pin };
    return input;
  }

  // Step 1: check the form, then show what is about to be charged.
  function review() {
    setShowErrors(true);
    if (blocked) return;
    checkout.reset();
    setConfirming({
      input: buildInput(),
      lines: cart.lines,
      subtotalMinor: cart.totals.subtotal,
      discountMinor: cart.totals.discount,
      pointsValueMinor: pointsValue,
      totalMinor: total,
      customerName: customer?.fullName ?? (phoneGiven ? customerDraft.fullName.trim() : null),
    });
  }

  // Step 2: the cashier confirmed; charge exactly what was shown.
  function pay(summary: ChargeSummary) {
    checkout.mutate(
      { input: summary.input, idempotencyKey: attemptKey },
      {
        onSuccess: (payment) => {
          setAttemptKey(newAttemptKey());
          setConfirming(null);
          setReceipt(payment);
        },
        onError: (error) => {
          setConfirming(null);
          // The server answered (validation, conflict...): the next attempt is a new one.
          if (error instanceof ApiError && error.status !== 0) setAttemptKey(newAttemptKey());
        },
      },
    );
  }

  function newSale() {
    cart.clear();
    setDetails(EMPTY_DETAILS);
    setCustomerDraft(EMPTY_CUSTOMER);
    setShowErrors(false);
    setReceipt(null);
    checkout.reset();
  }

  function retry() {
    // Card / PIN details are cleared after a decline; the basket and customer stay.
    setDetails({ ...EMPTY_DETAILS, tendered: details.tendered });
    setShowErrors(false);
    setReceipt(null);
    checkout.reset();
  }

  return (
    <>
      <PageHeader title="Checkout" subtitle={`Take a payment at ${merchant.tradingName}.`} />
      <div className={styles.layout}>
        <ProductPicker currency={merchant.currency} quantityOf={cart.quantityOf} onAdd={cart.add} />

        <aside className={styles.order} aria-label="Current order">
          <div className={styles.orderHead}>
            <h2 className={styles.orderTitle}>Order</h2>
            {cart.lines.length > 0 && (
              <button type="button" className={styles.linkButton} onClick={cart.clear}>
                Clear
              </button>
            )}
          </div>

          {cart.lines.length === 0 ? (
            <EmptyState icon="cart" title="No items yet">
              Tap a product to add it.
            </EmptyState>
          ) : (
            <ul className={styles.lines}>
              {cart.lines.map(({ product, quantity }) => (
                <li key={product.id} className={styles.line}>
                  <div className={styles.lineText}>
                    <span className={styles.lineName}>{product.name}</span>
                    <span className={styles.lineUnit}>
                      {money(product.price.finalPriceMinor)} each
                      {product.price.discountPercent > 0 && <span className={styles.lineOff}> −{product.price.discountPercent}%</span>}
                    </span>
                  </div>
                  <div className={styles.stepper}>
                    <button type="button" aria-label={`One less ${product.name}`} onClick={() => cart.setQuantity(product.id, quantity - 1)}>
                      <Icon name={quantity === 1 ? 'trash' : 'minus'} size={14} />
                    </button>
                    <span className="tabular">{quantity}</span>
                    <button
                      type="button"
                      aria-label={`One more ${product.name}`}
                      disabled={quantity >= MAX_QUANTITY}
                      onClick={() => cart.setQuantity(product.id, quantity + 1)}
                    >
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                  <span className={cx(styles.lineTotal, 'mono')}>{money(product.price.finalPriceMinor * quantity)}</span>
                </li>
              ))}
            </ul>
          )}

          <CustomerSection
            merchant={merchant}
            draft={customerDraft}
            required={method === 'CASH'}
            orderMinor={cart.totals.afterDiscount}
            showErrors={showErrors}
            onChange={setCustomerDraft}
            onResolved={onResolved}
          />

          <dl className={styles.totals}>
            <div>
              <dt>Subtotal</dt>
              <dd className="mono">{money(cart.totals.subtotal)}</dd>
            </div>
            {cart.totals.discount > 0 && (
              <div className={styles.saving}>
                <dt>Discounts</dt>
                <dd className="mono">−{money(cart.totals.discount)}</dd>
              </div>
            )}
            {pointsValue > 0 && (
              <div className={styles.saving}>
                <dt>{points} points</dt>
                <dd className="mono">−{money(pointsValue)}</dd>
              </div>
            )}
            <div className={styles.grandTotal}>
              <dt>To pay</dt>
              <dd className="mono">{money(Math.max(total, 0))}</dd>
            </div>
          </dl>

          <PaymentMethodForm
            merchant={merchant}
            method={method}
            details={details}
            totalMinor={total}
            showErrors={showErrors}
            onMethodChange={setMethod}
            onChange={setDetails}
          />

          {checkout.isError && (
            <Callout tone="danger">
              {checkout.error instanceof ApiError && checkout.error.status === 0
                ? 'No answer from the server. Press Charge again: the same payment will not be taken twice.'
                : errorMessage(checkout.error)}
            </Callout>
          )}

          <Button
            variant="primary"
            block
            disabled={cart.lines.length === 0 || checkout.isPending}
            className={styles.charge}
            onClick={review}
          >
            {cart.lines.length === 0 ? 'Add items to charge' : `Charge ${money(Math.max(total, 0))}`}
          </Button>
        </aside>
      </div>

      {confirming && (
        <ConfirmChargeDialog
          merchant={merchant}
          summary={confirming}
          busy={checkout.isPending}
          onConfirm={() => pay(confirming)}
          onClose={() => setConfirming(null)}
        />
      )}
      {receipt && <ReceiptDialog payment={receipt} onNewSale={newSale} onRetry={retry} />}
    </>
  );
}
