import { useState } from 'react';
import type { ReactNode } from 'react';
import { useMerchantProfile, useUpdateMerchantSettings } from '@/api/portalQueries';
import type { Merchant, MerchantSettingsInput } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Field, Input } from '@/components/ui/Field';
import { DetailList, Panel } from '@/components/ui/Panel';
import { PageLoader } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatMoney, toMajorInput, toMinorUnits } from '@/lib/format';
import { BUSINESS_TYPE_LABEL } from '@/lib/labels';
import styles from './Settings.module.css';

export function SettingsPage() {
  const profile = useMerchantProfile();
  const { hasRole } = useAuth();
  if (profile.isPending) return <PageLoader label="Loading settings" />;
  if (profile.isError) return <Callout tone="danger">{errorMessage(profile.error)}</Callout>;
  const editable = hasRole('MERCHANT_ADMIN');
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle={editable ? 'Your business profile and how you take payments.' : 'Your business profile. Only your admin can change settings.'}
      />
      <div className={styles.grid}>
        <ProfileSection merchant={profile.data} editable={editable} />
        <MethodsSection merchant={profile.data} editable={editable} />
        <SettlementSection merchant={profile.data} editable={editable} />
        <LoyaltySection merchant={profile.data} editable={editable} />
        <FraudSection merchant={profile.data} editable={editable} />
      </div>
    </>
  );
}

// Each section saves on its own, so a problem in one never blocks the others.
function useSection(successMessage: string) {
  const update = useUpdateMerchantSettings();
  const toast = useToast();
  return {
    update,
    save: (input: MerchantSettingsInput, onDone?: () => void) =>
      update.mutate(input, {
        onSuccess: () => {
          toast.success(successMessage);
          onDone?.();
        },
      }),
  };
}

function SaveBar({ busy, dirty, onSave, children }: { busy: boolean; dirty: boolean; onSave(): void; children?: ReactNode }) {
  return (
    <div className={styles.saveBar}>
      {children}
      <Button variant="primary" size="sm" loading={busy} disabled={!dirty} onClick={onSave}>
        Save
      </Button>
    </div>
  );
}

function ProfileSection({ merchant, editable }: { merchant: Merchant; editable: boolean }) {
  const { update, save } = useSection('Contact number saved');
  const [phone, setPhone] = useState(merchant.contactPhone);
  const valid = /^\+[1-9]\d{6,14}$/.test(phone.replace(/[\s()-]/g, ''));

  return (
    <Panel title="Business profile" description="From your approved application." className={styles.wide}>
      <div className={styles.profile}>
        <DetailList
          items={[
            ['Trading name', merchant.tradingName],
            ['Legal name', merchant.legalName],
            ['Business type', BUSINESS_TYPE_LABEL[merchant.businessType]],
            ['Category code', <span className="mono">{merchant.merchantCategoryCode}</span>],
          ]}
        />
        <DetailList
          items={[
            ['Owner', merchant.contactName],
            ['Email', merchant.contactEmail],
            ['Currency', <span className="mono">{merchant.currency}</span>],
            ['Merchant since', formatDate(merchant.createdAt)],
          ]}
        />
      </div>
      {editable && (
        <div className={styles.inline}>
          <Field label="Contact phone" error={!valid ? 'International format, e.g. +9779812345678' : undefined}>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} className="mono" />
          </Field>
          <Button
            size="md"
            loading={update.isPending}
            disabled={!valid || phone === merchant.contactPhone}
            onClick={() => save({ contactPhone: phone.replace(/[\s()-]/g, '') })}
          >
            Save
          </Button>
        </div>
      )}
      {update.isError && <Callout tone="danger">{errorMessage(update.error)}</Callout>}
    </Panel>
  );
}

function MethodsSection({ merchant, editable }: { merchant: Merchant; editable: boolean }) {
  const { update, save } = useSection('Payment methods saved');
  const [methods, setMethods] = useState({
    cash: merchant.acceptedMethods.cash,
    card: merchant.acceptedMethods.card,
    bankTransfer: merchant.acceptedMethods.bankTransfer,
  });
  const dirty =
    methods.cash !== merchant.acceptedMethods.cash ||
    methods.card !== merchant.acceptedMethods.card ||
    methods.bankTransfer !== merchant.acceptedMethods.bankTransfer;
  const none = !methods.cash && !methods.card && !methods.bankTransfer;

  return (
    <Panel title="Payment methods" description="What your till offers customers.">
      <div className={styles.switches}>
        <Switch disabled={!editable} checked={methods.cash} onChange={(cash) => setMethods({ ...methods, cash })} label="Cash" description="Needs the customer's name and phone, for loyalty and records." />
        <Switch disabled={!editable} checked={methods.card} onChange={(card) => setMethods({ ...methods, card })} label="Card" description="Visa, Mastercard, Amex and more. Card numbers are never stored." />
        <Switch
          disabled={!editable}
          checked={methods.bankTransfer}
          onChange={(bankTransfer) => setMethods({ ...methods, bankTransfer })}
          label="Bank transfer"
          description="The customer authorises with their account PIN."
        />
        <Switch disabled checked={false} onChange={() => undefined} label={<>QR payments <Badge>Coming soon</Badge></>} description="Not available yet." />
      </div>
      {none && <Callout tone="warning">Keep at least one method switched on.</Callout>}
      {update.isError && <Callout tone="danger">{errorMessage(update.error)}</Callout>}
      {editable && <SaveBar busy={update.isPending} dirty={dirty && !none} onSave={() => save({ acceptedMethods: methods })} />}
    </Panel>
  );
}

function SettlementSection({ merchant, editable }: { merchant: Merchant; editable: boolean }) {
  const { update, save } = useSection('Payout account saved');
  const [form, setForm] = useState({ bankName: '', accountHolder: merchant.legalName, accountNumber: '' });
  const [editing, setEditing] = useState(!merchant.settlement);
  const valid = form.bankName.trim().length >= 2 && form.accountHolder.trim().length >= 2 && /^[0-9 -]{6,34}$/.test(form.accountNumber);

  return (
    <Panel title="Payout account" description="Where your collected money is paid out.">
      {merchant.settlement && !editing ? (
        <>
          <DetailList
            items={[
              ['Bank', merchant.settlement.bankName],
              ['Account holder', merchant.settlement.accountHolder],
              ['Account', <span className="mono">•••• {merchant.settlement.accountLast4}</span>],
            ]}
          />
          {editable && (
            <div className={styles.saveBar}>
              <Button size="sm" variant="ghost" onClick={() => save({ settlementAccount: null })} loading={update.isPending}>
                Remove
              </Button>
              <Button size="sm" onClick={() => setEditing(true)}>
                Change
              </Button>
            </div>
          )}
        </>
      ) : editable ? (
        <>
          <div className={styles.fields}>
            <Field label="Bank name">
              <Input value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} />
            </Field>
            <Field label="Account holder">
              <Input value={form.accountHolder} onChange={(event) => setForm({ ...form, accountHolder: event.target.value })} />
            </Field>
            <Field label="Account number" hint="Stored encrypted; only the last 4 digits are shown afterwards." className={styles.full}>
              <Input value={form.accountNumber} onChange={(event) => setForm({ ...form, accountNumber: event.target.value.replace(/[^\d -]/g, '') })} className="mono" autoComplete="off" />
            </Field>
          </div>
          {update.isError && <Callout tone="danger">{errorMessage(update.error)}</Callout>}
          <SaveBar
            busy={update.isPending}
            dirty={valid}
            onSave={() =>
              save({ settlementAccount: { ...form, bankName: form.bankName.trim(), accountHolder: form.accountHolder.trim() } }, () => {
                setEditing(false);
                setForm({ ...form, accountNumber: '' });
              })
            }
          >
            {merchant.settlement && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </SaveBar>
        </>
      ) : (
        <p className={styles.muted}>No payout account yet.</p>
      )}
    </Panel>
  );
}

function LoyaltySection({ merchant, editable }: { merchant: Merchant; editable: boolean }) {
  const { update, save } = useSection('Loyalty rules saved');
  const { currency, loyalty } = merchant;
  const [enabled, setEnabled] = useState(loyalty.enabled);
  const [earnUnit, setEarnUnit] = useState(toMajorInput(loyalty.earnUnitMinor, currency));
  const [pointValue, setPointValue] = useState(toMajorInput(loyalty.pointValueMinor, currency));
  const [maxPercent, setMaxPercent] = useState(String(loyalty.maxRedeemPercent));

  const earnUnitMinor = toMinorUnits(earnUnit, currency);
  const pointValueMinor = toMinorUnits(pointValue, currency);
  const max = Number(maxPercent);
  const valid = !!earnUnitMinor && !!pointValueMinor && Number.isInteger(max) && max >= 0 && max <= 100;
  const dirty =
    enabled !== loyalty.enabled ||
    earnUnitMinor !== loyalty.earnUnitMinor ||
    pointValueMinor !== loyalty.pointValueMinor ||
    max !== loyalty.maxRedeemPercent;

  return (
    <Panel title="Loyalty points" description="Reward returning customers with points they can spend.">
      <Switch disabled={!editable} checked={enabled} onChange={setEnabled} label="Customers earn and use points" />
      <div className={styles.fields}>
        <Field label="Spend for 1 point" error={!earnUnitMinor ? 'Enter an amount.' : undefined}>
          <Input disabled={!editable || !enabled} value={earnUnit} onChange={(event) => setEarnUnit(event.target.value)} prefix={currency} inputMode="decimal" className="mono" />
        </Field>
        <Field label="1 point is worth" error={!pointValueMinor ? 'Enter an amount.' : undefined}>
          <Input disabled={!editable || !enabled} value={pointValue} onChange={(event) => setPointValue(event.target.value)} prefix={currency} inputMode="decimal" className="mono" />
        </Field>
        <Field label="Points can pay up to" hint="Percent of an order." error={!(max >= 0 && max <= 100) ? '0 to 100.' : undefined}>
          <Input disabled={!editable || !enabled} value={maxPercent} onChange={(event) => setMaxPercent(event.target.value)} inputMode="numeric" />
        </Field>
      </div>
      <LoyaltySummary
        currency={currency}
        enabled={enabled}
        earnUnitMinor={earnUnitMinor}
        pointValueMinor={pointValueMinor}
        maxPercent={valid ? max : null}
        unsaved={dirty && valid}
      />
      {update.isError && <Callout tone="danger">{errorMessage(update.error)}</Callout>}
      {editable && (
        <SaveBar
          busy={update.isPending}
          dirty={dirty && valid}
          onSave={() =>
            save({ loyalty: { enabled, earnUnitMinor: earnUnitMinor!, pointValueMinor: pointValueMinor!, maxRedeemPercent: max } })
          }
        />
      )}
    </Panel>
  );
}

interface LoyaltySummaryProps {
  currency: string;
  enabled: boolean;
  earnUnitMinor: number | null;
  pointValueMinor: number | null;
  maxPercent: number | null;
  unsaved: boolean;
}

// Explains the current rules in plain words, recalculated as the fields change.
function LoyaltySummary({ currency, enabled, earnUnitMinor, pointValueMinor, maxPercent, unsaved }: LoyaltySummaryProps) {
  const money = (minor: number) => formatMoney(minor, currency);
  const plural = (n: number, word: string) => `${n.toLocaleString('en')} ${word}${n === 1 ? '' : 's'}`;

  if (!enabled) {
    return (
      <div className={cx(styles.preview, styles.previewOff)}>
        <strong>Points are switched off.</strong> Customers keep the points they have, but they can't earn or use any
        until you switch this back on.
      </div>
    );
  }
  if (!earnUnitMinor || !pointValueMinor || maxPercent === null) {
    return <div className={cx(styles.preview, styles.previewOff)}>Fill in all three values to see how your points work.</div>;
  }

  const rewardPercent = (pointValueMinor / earnUnitMinor) * 100;
  // A round example basket: ten times the spend for one point.
  const exampleMinor = earnUnitMinor * 10;
  const earned = Math.floor(exampleMinor / earnUnitMinor);
  const capMinor = Math.floor((exampleMinor * maxPercent) / 100);
  const capPoints = Math.floor(capMinor / pointValueMinor);

  return (
    <div className={styles.preview}>
      <p>
        Every <strong>{money(earnUnitMinor)}</strong> spent earns 1 point, and each point takes{' '}
        <strong>{money(pointValueMinor)}</strong> off a later purchase: about{' '}
        <strong>{rewardPercent.toFixed(rewardPercent < 1 ? 2 : 1)}% back</strong>.
      </p>
      <p>
        A {money(exampleMinor)} order earns {plural(earned, 'point')} ({money(earned * pointValueMinor)} in rewards).{' '}
        {maxPercent === 0
          ? 'Points currently cannot be used to pay.'
          : `On the next ${money(exampleMinor)} order, points can pay up to ${maxPercent}%: ${plural(capPoints, 'point')}, ${money(capPoints * pointValueMinor)}.`}
      </p>
      {rewardPercent > 20 && <p className={styles.previewWarn}>That is a generous rate; most shops give 1–10% back.</p>}
      {unsaved && <p className={styles.previewNote}>Not saved yet.</p>}
    </div>
  );
}

function FraudSection({ merchant, editable }: { merchant: Merchant; editable: boolean }) {
  const { update, save } = useSection('Fraud threshold saved');
  const [threshold, setThreshold] = useState(toMajorInput(merchant.highValueThresholdMinor, merchant.currency));
  const minor = toMinorUnits(threshold, merchant.currency);

  return (
    <Panel title="Fraud protection" description="Every payment is screened before it reaches the bank." className={styles.wide}>
      <div className={styles.fraud}>
        <div>
          <Field label="High-value threshold" hint="Payments at or above this are held for a reviewer." error={!minor ? 'Enter an amount.' : undefined}>
            <Input disabled={!editable} value={threshold} onChange={(event) => setThreshold(event.target.value)} prefix={merchant.currency} inputMode="decimal" className="mono" />
          </Field>
          {update.isError && <Callout tone="danger">{errorMessage(update.error)}</Callout>}
          {editable && (
            <SaveBar busy={update.isPending} dirty={!!minor && minor !== merchant.highValueThresholdMinor} onSave={() => save({ highValueThresholdMinor: minor! })} />
          )}
        </div>
        <ul className={styles.rules}>
          <li>
            <strong>Held for review</strong> at a risk score of 40: e.g. a payment over your threshold.
          </li>
          <li>
            <strong>Blocked</strong> at 70, without contacting the bank: e.g. a very large first purchase by card, or a card
            declined twice in 30 minutes.
          </li>
          <li>
            <strong>Watched</strong> automatically: the same card or account used 3+ times in 10 minutes, and customers
            paying 4+ times in 10 minutes.
          </li>
        </ul>
      </div>
    </Panel>
  );
}
