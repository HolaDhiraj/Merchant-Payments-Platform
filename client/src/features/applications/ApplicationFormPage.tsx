import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@/api/http';
import { useApplication, useCreateApplication, useUpdateApplication } from '@/api/queries';
import type { MerchantApplication } from '@/api/types';
import { useCurrentUser } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Field, Input, Select } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { NotAllowed, NotFound } from '@/features/errors/NotAllowed';
import { errorMessage } from '@/lib/errors';
import { BUSINESS_TYPE_LABEL, SALES_CHANNEL_LABEL } from '@/lib/labels';
import {
  EMPTY_FORM,
  toCreateInput,
  toPatch,
  validate,
  valuesFrom,
  type ApplicationFormValues,
  type FormErrors,
} from './applicationForm';
import { canEdit } from './permissions';
import styles from './ApplicationFormPage.module.css';

export function NewApplicationPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateApplication();

  return (
    <ApplicationForm
      mode="create"
      initial={EMPTY_FORM}
      saving={create.isPending}
      error={create.error}
      onSave={(values) =>
        create.mutate(toCreateInput(values), {
          onSuccess: (application) => {
            toast.success('Draft saved. Submit it when you are ready.');
            navigate(`/applications/${application.id}`, { replace: true });
          },
        })
      }
    />
  );
}

export function EditApplicationPage() {
  const { id = '' } = useParams();
  const user = useCurrentUser();
  const query = useApplication(id);

  if (query.isPending) return <PageLoader label="Loading application" />;
  if (query.isError) {
    return query.error instanceof ApiError && query.error.isNotFound ? (
      <NotFound />
    ) : (
      <Callout tone="danger">{errorMessage(query.error)}</Callout>
    );
  }
  if (!canEdit(user, query.data)) return <NotAllowed />;
  return <EditForm application={query.data} />;
}

function EditForm({ application }: { application: MerchantApplication }) {
  const navigate = useNavigate();
  const toast = useToast();
  const update = useUpdateApplication(application.id);
  const detailPath = `/applications/${application.id}`;

  return (
    <ApplicationForm
      mode="edit"
      initial={valuesFrom(application)}
      application={application}
      saving={update.isPending}
      error={update.error}
      onSave={(values) => {
        const patch = toPatch(values, application);
        if (Object.keys(patch).length === 0) {
          navigate(detailPath);
          return;
        }
        update.mutate(patch, {
          onSuccess: () => {
            toast.success('Changes saved');
            navigate(detailPath);
          },
        });
      }}
    />
  );
}

interface ApplicationFormProps {
  mode: 'create' | 'edit';
  initial: ApplicationFormValues;
  application?: MerchantApplication;
  saving: boolean;
  error: Error | null;
  onSave(values: ApplicationFormValues): void;
}

function ApplicationForm({ mode, initial, application, saving, error, onSave }: ApplicationFormProps) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [attempted, setAttempted] = useState(false);
  const cancelTo = application ? `/applications/${application.id}` : '/applications';

  function bind(key: keyof ApplicationFormValues) {
    return {
      name: key,
      value: values[key],
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const next = { ...values, [key]: event.target.value };
        setValues(next);
        // After the first submit attempt, errors clear live as fields are fixed.
        if (attempted) setErrors(validate(next, mode));
      },
    };
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    const found = validate(values, mode);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    onSave(values);
  }

  const serverErrors = error instanceof ApiError && error.details.length > 1 ? error.details : null;
  const currency = values.currency.trim().toUpperCase() || 'USD';

  return (
    <>
      <PageHeader
        back={{ to: cancelTo, label: application ? application.businessName : 'Applications' }}
        title={mode === 'create' ? 'New application' : 'Edit application'}
        subtitle={
          mode === 'create'
            ? 'Saved as a draft. Nothing is sent for review until you submit it.'
            : application?.status === 'INFO_REQUESTED'
              ? 'Address the reviewer’s request, save, then resubmit.'
              : 'Changes are recorded in the audit trail.'
        }
      />

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {error && (
          <Callout tone="danger" title="The application couldn't be saved">
            {serverErrors ? (
              <ul>
                {serverErrors.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : (
              errorMessage(error)
            )}
          </Callout>
        )}

        <Panel title="Business" description="As registered with the tax authority.">
          <div className={styles.fields}>
            <Field label="Trading name" error={errors.businessName}>
              <Input {...bind('businessName')} placeholder="Corner Coffee" autoFocus={mode === 'create'} />
            </Field>
            <Field label="Legal name" error={errors.legalBusinessName}>
              <Input {...bind('legalBusinessName')} placeholder="Corner Coffee LLC" />
            </Field>
            <Field label="Entity type" error={errors.businessType}>
              <Select {...bind('businessType')}>
                <option value="" disabled>
                  Choose…
                </option>
                {Object.entries(BUSINESS_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Tax ID"
              optional={mode === 'edit'}
              error={errors.taxId}
              hint={
                mode === 'edit'
                  ? `On file: ${application?.taxIdMasked}. Leave blank to keep it.`
                  : 'Encrypted at rest. Only the last digits are ever shown.'
              }
            >
              <Input {...bind('taxId')} className="mono" autoComplete="off" placeholder={mode === 'edit' ? application?.taxIdMasked : '00-0000000'} />
            </Field>
          </div>
        </Panel>

        <Panel title="Owner" description="The person accountable for the merchant account.">
          <div className={styles.fields}>
            <Field label="Full name" error={errors.ownerName}>
              <Input {...bind('ownerName')} autoComplete="off" />
            </Field>
            <Field label="Email" error={errors.ownerEmail}>
              <Input {...bind('ownerEmail')} type="email" autoComplete="off" />
            </Field>
            <Field label="Phone" error={errors.ownerPhone} hint="International format, e.g. +15555550100">
              <Input {...bind('ownerPhone')} type="tel" className="mono" autoComplete="off" placeholder="+15555550100" />
            </Field>
          </div>
        </Panel>

        <Panel title="Processing profile" description="Used by the risk check to size exposure.">
          <div className={styles.fields}>
            <Field label="Merchant category code" error={errors.merchantCategoryCode} hint="ISO 18245, e.g. 5812 for restaurants">
              <Input {...bind('merchantCategoryCode')} className="mono" inputMode="numeric" maxLength={4} placeholder="5812" />
            </Field>
            <Field label="Currency" error={errors.currency}>
              <Input {...bind('currency')} className="mono" maxLength={3} placeholder="USD" />
            </Field>
            <Field label="Expected monthly volume" error={errors.monthlyVolume}>
              <Input {...bind('monthlyVolume')} prefix={currency} className="mono" inputMode="decimal" placeholder="25,000" />
            </Field>
            <Field label="Average ticket size" error={errors.averageTicket}>
              <Input {...bind('averageTicket')} prefix={currency} className="mono" inputMode="decimal" placeholder="45.00" />
            </Field>
            <Field label="How does the merchant take payments?" error={errors.salesChannel} className={styles.full}>
              <Select {...bind('salesChannel')}>
                <option value="" disabled>
                  Choose…
                </option>
                {Object.entries(SALES_CHANNEL_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Panel>

        <div className={styles.bar}>
          <span className={styles.barNote}>
            {mode === 'create' ? 'You can edit the draft until it is submitted.' : null}
          </span>
          <div className={styles.barActions}>
            <ButtonLink to={cancelTo}>Cancel</ButtonLink>
            <Button type="submit" variant="primary" loading={saving}>
              {mode === 'create' ? 'Save draft' : 'Save changes'}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
