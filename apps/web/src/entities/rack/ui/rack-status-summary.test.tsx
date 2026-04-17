import { render } from '@testing-library/react';
import { RackStatusSummary } from './rack-status-summary';

describe('RackStatusSummary', () => {
  const mockProps = {
    displayCode: '01-A',
    kind: 'single' as const,
    axis: 'NS' as const,
    occupancySummary: {
      occupancyRate: 0.45,
      occupiedCells: 45,
      totalCells: 100
    },
    levels: [
      { levelOrdinal: 1, occupiedCells: 10, totalCells: 25 },
      { levelOrdinal: 2, occupiedCells: 15, totalCells: 25 },
      { levelOrdinal: 3, occupiedCells: 20, totalCells: 25 }
    ]
  };

  it('renders with empty rack', () => {
    const { container } = render(
      <RackStatusSummary
        {...mockProps}
        occupancySummary={{
          occupancyRate: 0,
          occupiedCells: 0,
          totalCells: 100
        }}
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('renders with partial occupancy', () => {
    const { container } = render(<RackStatusSummary {...mockProps} />);
    expect(container).toMatchSnapshot();
  });

  it('renders with full occupancy', () => {
    const { container } = render(
      <RackStatusSummary
        {...mockProps}
        occupancySummary={{
          occupancyRate: 1.0,
          occupiedCells: 100,
          totalCells: 100
        }}
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('renders with different rack kind', () => {
    const { container } = render(
      <RackStatusSummary
        {...mockProps}
        kind="paired"
      />
    );
    expect(container).toMatchSnapshot();
  });
});
