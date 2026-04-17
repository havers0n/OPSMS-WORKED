export interface LocationAddressProps {
  rackDisplayCode: string;
  activeLevel: number;
  locationCode: string;
}

export function LocationAddress({
  rackDisplayCode,
  activeLevel,
  locationCode
}: LocationAddressProps) {
  return (
    <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap leading-relaxed">
      <span>{rackDisplayCode}</span>
      <span className="text-gray-300">/</span>
      <span>Level {activeLevel}</span>
      <span className="text-gray-300">/</span>
      <span className="font-mono text-gray-900 font-medium">{locationCode}</span>
    </div>
  );
}
