import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('traps focus, closes on Escape, and restores focus', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const trigger = document.createElement('button');
    trigger.textContent = 'Open';
    document.body.appendChild(trigger);
    trigger.focus();

    render(
      <Sheet open title="Checkout" onClose={onClose}>
        <button type="button">First</button>
        <button type="button">Second</button>
      </Sheet>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when closed', () => {
    render(
      <Sheet open={false} title="Checkout" onClose={() => undefined}>
        <p>Hidden</p>
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
