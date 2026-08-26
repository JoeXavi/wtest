import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { Pill } from './Pill';
import { ErrorBanner } from './ErrorBanner';
import { Money } from './Money';
import { Backdrop } from './Backdrop';
import { BrandIcon } from './BrandIcon';
import { Field } from './Field';

describe('Button', () => {
  it('shows loading state with aria-busy', () => {
    render(
      <Button loading>Pay</Button>,
    );
    expect(screen.getByRole('button', { name: /pay/i })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });
});

describe('Pill', () => {
  it('renders tones', () => {
    render(<Pill tone="success">OK</Pill>);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });
});

describe('ErrorBanner', () => {
  it('invokes retry', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    render(<ErrorBanner message="Failed" onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('Money component', () => {
  it('renders formatted amount', () => {
    render(<Money cents={150_000} />);
    expect(screen.getByText(/1\.500/)).toBeInTheDocument();
  });
});

describe('Backdrop', () => {
  it('toggles aria-expanded on strip', async () => {
    const user = userEvent.setup();
    render(
      <Backdrop stripTitle="Order" stripMeta="Visa •••• 4242">
        <p>Details</p>
      </Backdrop>,
    );
    const strip = screen.getByRole('button', { name: /order/i });
    expect(strip).toHaveAttribute('aria-expanded', 'true');
    await user.click(strip);
    expect(strip).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('BrandIcon', () => {
  it('renders for each brand', () => {
    const { rerender } = render(<BrandIcon brand="visa" />);
    expect(document.querySelector('svg')).toBeTruthy();
    rerender(<BrandIcon brand="mastercard" />);
    rerender(<BrandIcon brand="unknown" />);
  });
});

describe('Field', () => {
  it('wires label and shows error as alert', () => {
    render(
      <Field label="Email" error="Enter a valid email">
        <input />
      </Field>,
    );
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
  });
});
