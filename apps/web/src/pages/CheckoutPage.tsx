import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { CardBrand, LegalIdType } from '@norte/contracts';
import { copy } from '@/copy';
import {
  Button,
  CardNumberInput,
  CvcInput,
  ErrorBanner,
  ExpiryInput,
  Field,
  Sheet,
} from '@/components/ui';
import { ProductPage } from './ProductPage';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  closeSheet,
  tokenizeAndContinue,
  clearCheckoutError,
} from '@/store/slices/checkoutSlice';
import {
  detectBrand,
  isAddressLine1Valid,
  isCardholderValid,
  isCityOrRegionValid,
  isCvcValid,
  isEmailValid,
  isExpiryValid,
  isPhoneValid,
  luhnValid,
  digitsOnly,
} from '@/validators/card';
import styles from './CheckoutPage.module.css';

type FieldKey =
  | 'cardNumber'
  | 'expiry'
  | 'cvc'
  | 'cardholder'
  | 'email'
  | 'fullName'
  | 'phone'
  | 'legalId'
  | 'addressLine1'
  | 'city'
  | 'region';

export function CheckoutPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const step = useAppSelector((s) => s.checkout.step);
  const savedCustomer = useAppSelector((s) => s.checkout.customer);
  const savedDelivery = useAppSelector((s) => s.checkout.delivery);
  const tokenizing = useAppSelector((s) => s.checkout.ui.tokenizing);
  const error = useAppSelector((s) => s.checkout.ui.error);

  const [cardNumber, setCardNumber] = useState('');
  const [brand, setBrand] = useState<CardBrand>('unknown');
  const [expiry, setExpiry] = useState('');
  const cvcRef = useRef('');
  const [cardholder, setCardholder] = useState('');
  const [email, setEmail] = useState(savedCustomer?.email ?? '');
  const [fullName, setFullName] = useState(savedCustomer?.fullName ?? '');
  const [phone, setPhone] = useState(savedCustomer?.phone ?? '');
  const [legalId, setLegalId] = useState(savedCustomer?.legalId ?? '');
  const [legalIdType] = useState<LegalIdType>(
    savedCustomer?.legalIdType ?? 'CC',
  );
  const [addressLine1, setAddressLine1] = useState(
    savedDelivery?.addressLine1 ?? '',
  );
  const [addressLine2, setAddressLine2] = useState(
    savedDelivery?.addressLine2 ?? '',
  );
  const [city, setCity] = useState(savedDelivery?.city ?? '');
  const [region, setRegion] = useState(savedDelivery?.region ?? '');
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>(
    {},
  );

  const cardNumberRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const cvcInputRef = useRef<HTMLInputElement>(null);
  const cardholderRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const fullNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const legalIdRef = useRef<HTMLInputElement>(null);
  const addressLine1Ref = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const regionRef = useRef<HTMLInputElement>(null);

  const fieldRefs: Record<FieldKey, React.RefObject<HTMLInputElement | null>> = {
    cardNumber: cardNumberRef,
    expiry: expiryRef,
    cvc: cvcInputRef,
    cardholder: cardholderRef,
    email: emailRef,
    fullName: fullNameRef,
    phone: phoneRef,
    legalId: legalIdRef,
    addressLine1: addressLine1Ref,
    city: cityRef,
    region: regionRef,
  };

  const open = step === 'details';

  useEffect(() => {
    if (step === 'product') {
      navigate('/', { replace: true });
    } else if (step === 'summary') {
      navigate('/checkout/summary', { replace: true });
    } else if (step === 'result') {
      navigate('/checkout/result', { replace: true });
    }
  }, [step, navigate]);

  const validateField = useCallback(
    (key: FieldKey): string | undefined => {
      switch (key) {
        case 'cardNumber': {
          if (!luhnValid(cardNumber)) return copy.errors.cardNumber;
          if (detectBrand(cardNumber) === 'unknown') return copy.errors.cardBrand;
          return undefined;
        }
        case 'expiry':
          return isExpiryValid(expiry) ? undefined : copy.errors.expiry;
        case 'cvc':
          return isCvcValid(cvcRef.current, brand)
            ? undefined
            : copy.errors.cvc;
        case 'cardholder':
          return isCardholderValid(cardholder)
            ? undefined
            : copy.errors.cardholder;
        case 'email':
          return isEmailValid(email) ? undefined : copy.errors.email;
        case 'fullName':
          return isCardholderValid(fullName)
            ? undefined
            : copy.errors.cardholder;
        case 'phone':
          return isPhoneValid(phone) ? undefined : copy.errors.phone;
        case 'legalId':
          return legalId.trim().length >= 4 ? undefined : copy.errors.required;
        case 'addressLine1':
          return isAddressLine1Valid(addressLine1)
            ? undefined
            : copy.errors.addressLine1;
        case 'city':
          return isCityOrRegionValid(city) ? undefined : copy.errors.required;
        case 'region':
          return isCityOrRegionValid(region) ? undefined : copy.errors.required;
        default:
          return undefined;
      }
    },
    [
      cardNumber,
      expiry,
      brand,
      cardholder,
      email,
      fullName,
      phone,
      legalId,
      addressLine1,
      city,
      region,
    ],
  );

  const onBlur = (key: FieldKey) => {
    setTouched((t) => ({ ...t, [key]: true }));
    setErrors((e) => ({ ...e, [key]: validateField(key) }));
  };

  const validateAll = (): FieldKey | null => {
    const keys: FieldKey[] = [
      'cardNumber',
      'expiry',
      'cvc',
      'cardholder',
      'email',
      'fullName',
      'phone',
      'legalId',
      'addressLine1',
      'city',
      'region',
    ];
    const next: Partial<Record<FieldKey, string>> = {};
    let first: FieldKey | null = null;
    for (const key of keys) {
      const msg = validateField(key);
      if (msg) {
        next[key] = msg;
        if (!first) first = key;
      }
    }
    setErrors(next);
    setTouched(Object.fromEntries(keys.map((k) => [k, true])));
    return first;
  };

  const onClose = () => {
    dispatch(closeSheet());
    navigate('/');
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const firstInvalid = validateAll();
    if (firstInvalid) {
      fieldRefs[firstInvalid].current?.focus();
      return;
    }

    const result = await dispatch(
      tokenizeAndContinue({
        number: digitsOnly(cardNumber),
        cvc: cvcRef.current,
        expiry,
        cardHolder: cardholder,
        customer: {
          email: email.trim(),
          fullName: fullName.trim(),
          phone: phone.trim(),
          legalId: legalId.trim(),
          legalIdType,
        },
        delivery: {
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          region: region.trim(),
          country: 'CO',
        },
      }),
    );

    if (tokenizeAndContinue.fulfilled.match(result)) {
      navigate('/checkout/summary');
    }
  };

  const show = (key: FieldKey) => (touched[key] ? errors[key] : undefined);

  return (
    <>
      <ProductPage />
      <Sheet open={open} title={copy.brand} onClose={onClose}>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          {error ? (
            <ErrorBanner
              message={error}
              onRetry={() => dispatch(clearCheckoutError())}
            />
          ) : null}

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{copy.cardSection}</h3>
            <Field
              label={copy.cardNumber}
              helper={copy.testCardsHelper}
              error={show('cardNumber')}
            >
              <CardNumberInput
                ref={fieldRefs.cardNumber}
                value={cardNumber}
                onChange={(v, b) => {
                  setCardNumber(v);
                  setBrand(b);
                }}
                onBlur={() => onBlur('cardNumber')}
              />
            </Field>
            <div className={styles.row}>
              <Field label={copy.expiry} error={show('expiry')}>
                <ExpiryInput
                  ref={fieldRefs.expiry}
                  value={expiry}
                  onChange={setExpiry}
                  onBlur={() => onBlur('expiry')}
                />
              </Field>
              <Field label={copy.cvc} error={show('cvc')}>
                <CvcInput
                  ref={fieldRefs.cvc}
                  onValueChange={(v) => {
                    cvcRef.current = v;
                  }}
                  onBlur={() => onBlur('cvc')}
                />
              </Field>
            </div>
            <Field label={copy.cardholder} error={show('cardholder')}>
              <input
                ref={fieldRefs.cardholder}
                className={styles.nativeInput}
                autoComplete="cc-name"
                value={cardholder}
                onChange={(e) => setCardholder(e.target.value)}
                onBlur={() => onBlur('cardholder')}
              />
            </Field>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{copy.deliverySection}</h3>
            <Field label={copy.email} error={show('email')}>
              <input
                ref={fieldRefs.email}
                className={styles.nativeInput}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => onBlur('email')}
              />
            </Field>
            <Field label={copy.fullName} error={show('fullName')}>
              <input
                ref={fieldRefs.fullName}
                className={styles.nativeInput}
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={() => onBlur('fullName')}
              />
            </Field>
            <Field label={copy.phone} error={show('phone')}>
              <input
                ref={fieldRefs.phone}
                className={styles.nativeInput}
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => onBlur('phone')}
              />
            </Field>
            <Field label={copy.legalId} error={show('legalId')}>
              <input
                ref={fieldRefs.legalId}
                className={styles.nativeInput}
                value={legalId}
                onChange={(e) => setLegalId(e.target.value)}
                onBlur={() => onBlur('legalId')}
              />
            </Field>
            <Field label={copy.addressLine1} error={show('addressLine1')}>
              <input
                ref={fieldRefs.addressLine1}
                className={styles.nativeInput}
                autoComplete="address-line1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                onBlur={() => onBlur('addressLine1')}
              />
            </Field>
            <Field label={copy.addressLine2}>
              <input
                className={styles.nativeInput}
                autoComplete="address-line2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
              />
            </Field>
            <div className={styles.row}>
              <Field label={copy.city} error={show('city')}>
                <input
                  ref={fieldRefs.city}
                  className={styles.nativeInput}
                  autoComplete="address-level2"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onBlur={() => onBlur('city')}
                />
              </Field>
              <Field label={copy.region} error={show('region')}>
                <input
                  ref={fieldRefs.region}
                  className={styles.nativeInput}
                  autoComplete="address-level1"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  onBlur={() => onBlur('region')}
                />
              </Field>
            </div>
          </section>

          <div className={styles.footer}>
            <Button type="submit" fullWidth loading={tokenizing}>
              {copy.continueToSummary}
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
