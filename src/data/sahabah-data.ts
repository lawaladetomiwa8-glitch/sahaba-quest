
export interface SahabahProfile {
  slug: string;
  name: string;
  title?: string;
  category: string;
  arabicName: string;
  summary: string;
  highlights: string[];
  sourceLabel: string;
}

export const sahabahProfiles: SahabahProfile[] = [];

export function getSahabahProfile(
  slug: string,
): SahabahProfile | undefined {
  return sahabahProfiles.find((profile) => profile.slug === slug);
}
