export type SahabahProfile = {
  slug: string;
  name: string;
  arabicName: string;
  title: string;
  category: string;
  summary: string;
  highlights: string[];
  sourceLabel: string;
};

export const sahabahProfiles: SahabahProfile[] = [
  {
    slug: "abu-bakr-as-siddiq",
    name: "Abu Bakr as-Siddiq",
    arabicName: "أبو بكر الصديق رضي الله عنه",
    title: "The First Caliph",
    category: "The Rightly Guided Caliphs",
    summary:
      "Abu Bakr as-Siddiq was a close companion and adviser of the Prophet Muhammad ﷺ and became the first caliph after the Prophet's death.",
    highlights: [
      "A close companion of the Prophet Muhammad ﷺ.",
      "Accompanied the Prophet ﷺ during the Hijrah to Madinah.",
      "Served as the first caliph of the Muslim community.",
    ],
    sourceLabel: "Encyclopaedia Britannica",
  },
  {
    slug: "umar-ibn-al-khattab",
    name: "Umar ibn al-Khattab",
    arabicName: "عمر بن الخطاب رضي الله عنه",
    title: "The Second Caliph",
    category: "The Rightly Guided Caliphs",
    summary:
      "Umar ibn al-Khattab was a senior companion of the Prophet Muhammad ﷺ who became the second caliph and played a major role in the administration of the early Muslim state.",
    highlights: [
      "Became one of the Prophet's chief advisers after accepting Islam.",
      "Succeeded Abu Bakr as the second caliph.",
      "His caliphate saw major expansion and administrative development.",
    ],
    sourceLabel: "Encyclopaedia Britannica",
  },
  {
    slug: "uthman-ibn-affan",
    name: "Uthman ibn Affan",
    arabicName: "عثمان بن عفان رضي الله عنه",
    title: "The Third Caliph",
    category: "The Rightly Guided Caliphs",
    summary:
      "Uthman ibn Affan was a senior companion and son-in-law of the Prophet Muhammad ﷺ who became the third caliph of the Muslim community.",
    highlights: [
      "Was a senior companion of the Prophet Muhammad ﷺ.",
      "Became the third caliph after Umar ibn al-Khattab.",
      "Is closely associated with the standardization of the written Qur'an copies during his caliphate.",
    ],
    sourceLabel: "Encyclopaedia Britannica",
  },
  {
    slug: "ali-ibn-abi-talib",
    name: "Ali ibn Abi Talib",
    arabicName: "علي بن أبي طالب رضي الله عنه",
    title: "The Fourth Caliph",
    category: "The Rightly Guided Caliphs",
    summary:
      "Ali ibn Abi Talib was a close companion and relative of the Prophet Muhammad ﷺ, his son-in-law, and the fourth caliph of the Muslim community.",
    highlights: [
      "Was among the earliest people to accept Islam.",
      "Was a close relative and son-in-law of the Prophet Muhammad ﷺ.",
      "Became the fourth caliph in 656 CE.",
    ],
    sourceLabel: "Encyclopaedia Britannica",
  },
];

export function getSahabahProfile(slug: string) {
  return sahabahProfiles.find((profile) => profile.slug === slug);
}
