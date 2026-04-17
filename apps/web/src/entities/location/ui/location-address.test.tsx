import { render } from '@testing-library/react';
import { LocationAddress } from './location-address';

describe('LocationAddress', () => {
  it('renders standard location address', () => {
    const { container } = render(
      <LocationAddress
        rackDisplayCode="01-A"
        activeLevel={2}
        locationCode="02.03.01"
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('renders different rack display codes and levels', () => {
    const { container } = render(
      <LocationAddress
        rackDisplayCode="10-C"
        activeLevel={3}
        locationCode="04.01.02"
      />
    );
    expect(container).toMatchSnapshot();
  });
});
