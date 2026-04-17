import { render } from '@testing-library/react';
import { OccupancyBar } from './occupancy-bar';

describe('OccupancyBar', () => {
  it('renders at 0%', () => {
    const { container } = render(<OccupancyBar rate={0} />);
    expect(container).toMatchSnapshot();
  });

  it('renders at 50%', () => {
    const { container } = render(<OccupancyBar rate={0.5} />);
    expect(container).toMatchSnapshot();
  });

  it('renders at 100%', () => {
    const { container } = render(<OccupancyBar rate={1.0} />);
    expect(container).toMatchSnapshot();
  });

  it('renders with custom label', () => {
    const { container } = render(<OccupancyBar rate={0.75} label="3/4" />);
    expect(container).toMatchSnapshot();
  });
});
