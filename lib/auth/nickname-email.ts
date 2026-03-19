export function nicknameToEmail(nickname: string) {
  const normalized = nickname.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'traveler';
  return `${normalized}@tripmaster.local`;
}
