import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Stepper } from './Stepper';

describe('Stepper', () => {
  it('clamps at min and max bounds', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { rerender } = render(
      <Stepper value={1} min={1} max={3} onChange={onChange} />,
    );

    const dec = screen.getByRole('button', { name: /decrease hours/i });
    const inc = screen.getByRole('button', { name: /increase hours/i });

    expect(dec).toBeDisabled();
    expect(inc).not.toBeDisabled();

    await user.click(inc);
    expect(onChange).toHaveBeenCalledWith(2);

    rerender(<Stepper value={3} min={1} max={3} onChange={onChange} />);
    expect(screen.getByRole('button', { name: /increase hours/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /decrease hours/i })).not.toBeDisabled();
  });

  it('exposes hours-stepper test id and live value', () => {
    render(<Stepper value={2} max={5} onChange={() => undefined} />);
    expect(screen.getByTestId('hours-stepper')).toBeInTheDocument();
    expect(screen.getByText('2')).toHaveAttribute('aria-live', 'polite');
  });
});
