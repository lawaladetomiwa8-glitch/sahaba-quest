import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as XLSX from 'xlsx';
import { Button, Card, Field, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type SchoolClass = { id: string; class_name: string; academic_session: string; status: string; student_count?: number };
type SchoolStudent = { id: string; first_name: string; last_name: string; student_id: string; status: string; school_classes?: { class_name: string; academic_session: string } | null };
type CreatedCredentials = { student_id: string; pin: string };

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { values.push(value.trim()); value = ''; }
    else value += char;
  }
  values.push(value.trim());
  return values;
}

export default function SchoolManagementScreen() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [className, setClassName] = useState('');
  const [academicSession, setAcademicSession] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [classId, setClassId] = useState('');
  const [csvText, setCsvText] = useState('');
  const [bulkCredentials, setBulkCredentials] = useState<CreatedCredentials[]>([]);
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in as a school administrator to manage students.');
      const [classResult, studentResult] = await Promise.all([
        apiRequest<{ classes: SchoolClass[] }>('/api/schools/classes', { token: session.access_token }),
        apiRequest<{ students: SchoolStudent[]; seats?: { limit: number; used: number; remaining: number } }>('/api/schools/students', { token: session.access_token }),
      ]);
      setClasses(classResult.classes || []);
      setStudents(studentResult.students || []);
      if (!classId && classResult.classes?.length) setClassId(classResult.classes[0].id);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load school records.'); }
    finally { setLoading(false); }
  }, [classId]);

  useEffect(() => { void load(); }, [load]);

  async function createClass() {
    setSaving(true); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your administrator session has expired.');
      await apiRequest('/api/schools/classes', { method: 'POST', token: session.access_token, body: JSON.stringify({ class_name: className, academic_session: academicSession }) });
      setClassName(''); setAcademicSession(''); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to create class.'); }
    finally { setSaving(false); }
  }

  async function createStudent() {
    setSaving(true); setMessage(''); setCredentials(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your administrator session has expired.');
      const result = await apiRequest<{ credentials: CreatedCredentials }>('/api/schools/students', { method: 'POST', token: session.access_token, body: JSON.stringify({ first_name: firstName, last_name: lastName, class_id: classId }) });
      setCredentials(result.credentials); setFirstName(''); setLastName(''); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to create student.'); }
    finally { setSaving(false); }
  }

  async function updateStudent(student: SchoolStudent, payload: { status?: 'active' | 'inactive'; reset_pin?: boolean }) {
    setSaving(true); setMessage(''); setCredentials(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your administrator session has expired.');
      const result = await apiRequest<{ credentials?: CreatedCredentials }>(`/api/schools/students/${encodeURIComponent(student.id)}`, { method: 'PATCH', token: session.access_token, body: JSON.stringify(payload) });
      if (result.credentials) setCredentials(result.credentials);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update student.'); }
    finally { setSaving(false); }
  }

  async function updateClass(schoolClass: SchoolClass) {
    setSaving(true); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your administrator session has expired.');
      const status = schoolClass.status === 'active' ? 'archived' : 'active';
      await apiRequest(`/api/schools/classes/${encodeURIComponent(schoolClass.id)}`, { method: 'PATCH', token: session.access_token, body: JSON.stringify({ status }) });
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update class.'); }
    finally { setSaving(false); }
  }

  async function importCsv() {
    setSaving(true); setMessage(''); setBulkCredentials([]);
    try {
      const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (!lines.length) throw new Error('Paste CSV rows with first_name, last_name, and class_name columns.');
      const first = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase().replace(/\s+/g, '_'));
      const hasHeader = first.some((cell) => ['first_name', 'firstname', 'first'].includes(cell));
      const rows = (hasHeader ? lines.slice(1) : lines).map((line) => parseCsvLine(line));
      const students = rows.map((cells) => {
        const values: Record<string, string> = hasHeader ? Object.fromEntries(first.map((key, index) => [key, cells[index] || ''])) : { first_name: cells[0], last_name: cells[1], class_name: cells[2] };
        return { first_name: values.first_name || values.firstname || values.first || '', last_name: values.last_name || values.lastname || values.last || '', class_name: values.class_name || values.class || '' };
      });
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your administrator session has expired.');
      const result = await apiRequest<{ credentials: CreatedCredentials[]; message: string }>('/api/schools/students/bulk', { method: 'POST', token: session.access_token, body: JSON.stringify({ students }) });
      setBulkCredentials(result.credentials || []); setMessage(result.message || 'Students imported. Save these credentials now.'); setCsvText(''); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to import students.'); }
    finally { setSaving(false); }
  }

  async function pickStudentFile() {
    setMessage('');
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset || (asset.size && asset.size > 10 * 1024 * 1024)) throw new Error('Choose a student list smaller than 10 MB.');
      const extension = asset.name.split('.').pop()?.toLowerCase();
      let rows: unknown[][];
      if (extension === 'csv') {
        const csv = await new File(asset.uri).text();
        setCsvText(csv);
        setMessage('CSV loaded. Review it below, then tap Import students.');
        return;
      }
      if (extension !== 'xlsx' && extension !== 'xls') throw new Error('Select a .csv, .xlsx, or .xls student list.');
      const workbook = XLSX.read(await new File(asset.uri).base64(), { type: 'base64' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('The workbook does not contain a readable first sheet.');
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][];
      const csv = rows.map((row) => row.map((cell) => {
        const value = String(cell ?? '');
        return /[",\n\r]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
      }).join(',')).join('\n');
      setCsvText(csv);
      setMessage('Spreadsheet loaded. Review the rows below, then tap Import students.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read the selected student list.');
    }
  }

  async function shareStudentCredentials(items: CreatedCredentials[]) {
    if (!items.length) return;
    const message = ['Sahaba Quest student login details', ...items.map((item) => 'Student ID: ' + item.student_id + ' · PIN: ' + item.pin), 'Keep these credentials private and give each student only their own details.'].join('\n');
    await Share.share({ title: 'Student login credentials', message });
  }

  function deleteStudent(student: SchoolStudent) {
    Alert.alert('Delete student?', `${student.first_name} ${student.last_name} and associated learning records will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void (async () => {
        setSaving(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('Your administrator session has expired.');
          await apiRequest(`/api/schools/students/${encodeURIComponent(student.id)}`, { method: 'DELETE', token: session.access_token });
          await load();
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to delete student.'); }
        finally { setSaving(false); }
      })() },
    ]);
  }

  return <Screen>
    <Heading title="Students and classes" subtitle="Manage records through your school account. Student IDs and PINs come from the existing school service." />
    <Notice message={message} />
    {loading ? <ActivityIndicator color={colors.teal} /> : <>
      <Card><Text style={styles.heading}>Classes · {classes.length}</Text>
        {classes.map((item) => <View key={item.id} style={styles.classItem}><View style={styles.classInfo}><Text style={styles.name}>{item.class_name}</Text><Text style={uiStyles.smallMuted}>{item.academic_session} · {item.status} · {item.student_count ?? 0} students</Text></View><Button title={item.status === 'active' ? 'Archive' : 'Reactivate'} secondary disabled={saving} onPress={() => void updateClass(item)} /></View>)}
        <Field label="Class name" value={className} onChangeText={setClassName} placeholder="e.g. JSS 1" />
        <Field label="Academic session" value={academicSession} onChangeText={setAcademicSession} placeholder="e.g. 2026/2027" />
        <Button title={saving ? 'Saving…' : 'Create class'} disabled={saving || !className.trim() || !academicSession.trim()} onPress={() => void createClass()} />
      </Card>
      <Card><Text style={styles.heading}>Add a student</Text>
        <Field label="First name" value={firstName} onChangeText={setFirstName} />
        <Field label="Last name" value={lastName} onChangeText={setLastName} />
        {classes.map((item) => <Button key={item.id} title={`${classId === item.id ? '✓ ' : ''}${item.class_name} · ${item.academic_session}`} secondary={classId !== item.id} onPress={() => setClassId(item.id)} />)}
        {classes.length === 0 ? <Text style={uiStyles.smallMuted}>Create an active class before adding students.</Text> : <Button title={saving ? 'Creating…' : 'Create student credentials'} disabled={saving || !firstName.trim() || !lastName.trim() || !classId} onPress={() => void createStudent()} />}
        {credentials ? <View style={styles.credentials}><Text style={styles.heading}>Give these credentials to the student</Text><Text style={styles.credential}>Student ID: {credentials.student_id}</Text><Text style={styles.credential}>6-digit PIN: {credentials.pin}</Text><Text style={uiStyles.smallMuted}>The PIN is shown only in this creation response. Save or share it now.</Text><Button title="Share credentials securely" secondary onPress={() => void shareStudentCredentials([credentials])} /></View> : null}
      </Card>
      <Card><Text style={styles.heading}>Student records · {students.length}</Text>
        {students.map((student) => <View key={student.id} style={styles.student}><Text style={styles.name}>{student.first_name} {student.last_name}</Text><Text style={uiStyles.smallMuted}>{student.student_id}</Text><Text style={uiStyles.smallMuted}>{student.school_classes?.class_name || 'No class'} · {student.school_classes?.academic_session || ''} · {student.status}</Text><View style={styles.actions}><Button title={student.status === 'active' ? 'Deactivate' : 'Activate'} secondary disabled={saving} onPress={() => void updateStudent(student, { status: student.status === 'active' ? 'inactive' : 'active' })} /><Button title="Reset PIN" secondary disabled={saving} onPress={() => void updateStudent(student, { reset_pin: true })} /><Button title="Delete" secondary disabled={saving} onPress={() => deleteStudent(student)} /></View></View>)}
        {students.length === 0 ? <Text style={uiStyles.smallMuted}>No student records yet.</Text> : null}
      </Card>
      <Card><Text style={styles.heading}>Bulk student import</Text><Text style={uiStyles.smallMuted}>Choose a CSV or Excel workbook, or paste CSV rows with first_name, last_name, and class_name columns. The first worksheet is read for Excel files. The existing school bulk import API validates the records and available seats.</Text><Button title="Choose CSV / Excel file" secondary disabled={saving} onPress={() => void pickStudentFile()} /><TextInput multiline value={csvText} onChangeText={setCsvText} placeholder={'first_name,last_name,class_name\nAmina,Yusuf,Primary 4'} placeholderTextColor={colors.muted} textAlignVertical="top" style={styles.csv} /><Button title={saving ? 'Importing…' : 'Import students'} disabled={saving || !csvText.trim()} onPress={() => void importCsv()} />{bulkCredentials.length ? <View style={styles.credentials}><Text style={styles.heading}>Save these one-time credentials</Text>{bulkCredentials.map((item) => <Text key={item.student_id} style={styles.bulkLine}>{item.student_id} · PIN {item.pin}</Text>)}<Button title="Share all credentials" secondary onPress={() => void shareStudentCredentials(bulkCredentials)} /></View> : null}</Card>
    </>}
    <Button title="Refresh records" secondary onPress={() => void load()} />
  </Screen>;
}

const styles = StyleSheet.create({ heading: { color: colors.ink, fontWeight: '900', fontSize: 18 }, classItem: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 }, classInfo: { flex: 1 }, student: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 12, gap: 8 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, name: { color: colors.ink, fontWeight: '800' }, count: { color: colors.teal, fontWeight: '900' }, credentials: { backgroundColor: colors.mint, borderRadius: 14, padding: 14, gap: 8 }, credential: { color: colors.ink, fontSize: 18, fontWeight: '900', letterSpacing: 0.4 }, csv: { minHeight: 130, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 12, color: colors.ink, backgroundColor: '#fff' }, bulkLine: { color: colors.ink, fontSize: 14, fontWeight: '800' } });
