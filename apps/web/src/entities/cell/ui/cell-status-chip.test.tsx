import { render } from '@testing-library/react';
import { CellStatusChip } from './cell-status-chip';

describe('CellStatusChip', () => {
  it('renders occupied state', () => {
    const { container } = render(<CellStatusChip occupied={true} />);
    expect(container).toMatchSnapshot();
  });

  it('renders empty state', () => {
    const { container } = render(<CellStatusChip occupied={false} />);
    expect(container).toMatchSnapshot();
  });
});
