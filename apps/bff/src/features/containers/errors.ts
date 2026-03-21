export function isContainerTypeConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const details = 'details' in error && typeof error.details === 'string' ? error.details : '';
  const constraint = 'constraint' in error && typeof error.constraint === 'string' ? error.constraint : '';

  return [message, details, constraint].some(
    (value) => value.includes('container_type') || value.includes('containers_container_type_id_fkey')
  );
}
