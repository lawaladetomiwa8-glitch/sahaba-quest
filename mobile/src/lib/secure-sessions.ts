import * as SecureStore from 'expo-secure-store';

const STUDENT_TOKEN_KEY = 'sahabaquest.school_student.token';
const STUDENT_EXPIRY_KEY = 'sahabaquest.school_student.expires_at';
const FAMILY_MEMBER_TOKEN_KEY = 'sahabaquest.family_member.token';

export type StudentSession = { token: string; expiresAt: string };

export async function saveStudentSession(session: StudentSession) {
  await SecureStore.setItemAsync(STUDENT_TOKEN_KEY, session.token);
  await SecureStore.setItemAsync(STUDENT_EXPIRY_KEY, session.expiresAt);
}

export async function getStudentSession(): Promise<StudentSession | null> {
  const [token, expiresAt] = await Promise.all([
    SecureStore.getItemAsync(STUDENT_TOKEN_KEY),
    SecureStore.getItemAsync(STUDENT_EXPIRY_KEY),
  ]);
  if (!token || !expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
    await clearStudentSession();
    return null;
  }
  return { token, expiresAt };
}

export async function clearStudentSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(STUDENT_TOKEN_KEY),
    SecureStore.deleteItemAsync(STUDENT_EXPIRY_KEY),
  ]);
}

export async function saveFamilyMemberSession(token: string) {
  await SecureStore.setItemAsync(FAMILY_MEMBER_TOKEN_KEY, token);
}

export async function getFamilyMemberSession() {
  return SecureStore.getItemAsync(FAMILY_MEMBER_TOKEN_KEY);
}

export async function clearFamilyMemberSession() {
  await SecureStore.deleteItemAsync(FAMILY_MEMBER_TOKEN_KEY);
}
