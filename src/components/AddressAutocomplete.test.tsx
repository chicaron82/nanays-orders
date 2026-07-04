import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddressAutocomplete } from './AddressAutocomplete';

// Keep shortAddress (pure) real; stub only the network search.
vi.mock('../lib/routing', async (orig) => {
  const actual = await orig<typeof import('../lib/routing')>();
  return { ...actual, searchAddresses: vi.fn() };
});
import { searchAddresses } from '../lib/routing';

describe('AddressAutocomplete', () => {
  it('renders the input with the controlled value', () => {
    render(<AddressAutocomplete value="1577 Erin St" onChange={vi.fn()} onPick={vi.fn()} />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('1577 Erin St');
  });

  it('fires onChange on type (parent clears any stale coords)', () => {
    const onChange = vi.fn();
    render(<AddressAutocomplete value="" onChange={onChange} onPick={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '629 Sher' } });
    expect(onChange).toHaveBeenCalledWith('629 Sher');
  });

  it('searches on focus and pins coords when a candidate is picked', async () => {
    (searchAddresses as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { label: '1577 Erin Street, Winnipeg', lat: 49.88, lng: -97.17 },
    ]);
    const onPick = vi.fn();
    render(<AddressAutocomplete value="1577 Erin St" onChange={vi.fn()} onPick={onPick} />);
    fireEvent.focus(screen.getByRole('textbox'));

    const option = await screen.findByText('1577 Erin Street, Winnipeg');
    fireEvent.mouseDown(option);
    expect(onPick).toHaveBeenCalledWith('1577 Erin Street, Winnipeg', 49.88, -97.17);
  });

  it('shows the pinned check when coords are set', () => {
    render(<AddressAutocomplete value="629 Sherburn St, Winnipeg" pinned onChange={vi.fn()} onPick={vi.fn()} />);
    expect(screen.queryByLabelText('location pinned')).not.toBeNull();
  });
});
