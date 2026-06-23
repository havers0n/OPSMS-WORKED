export function resolveSupabaseAuthStorageKey(supabaseUrl: string): string {
  const parsedUrl = new URL(supabaseUrl);
  return `sb-${parsedUrl.hostname.split('.')[0]}-auth-token`;
}
