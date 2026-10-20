export type SyncAction = 'upload' | 'download' | 'none';

export function decideSync(
  local: { modifiedAt: string; isEmpty: boolean },
  remoteModifiedAt: string | null,
): SyncAction {
  if (remoteModifiedAt === null) return local.isEmpty ? 'none' : 'upload';
  if (local.isEmpty) return 'download';
  if (remoteModifiedAt > local.modifiedAt) return 'download';
  if (local.modifiedAt > remoteModifiedAt) return 'upload';
  return 'none';
}
