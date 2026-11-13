import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { HOLIDAYS_2027 } from './src/holidays';
import {
  addAccount,
  addBalanceUpdate,
  addCategory,
  addContact,
  addEntry,
  addEvent,
  addNote,
  dayRecord,
  deleteContact,
  deleteEntry,
  deleteEvent,
  deleteNote,
  emptyDiary,
  eventSummary,
  latestBalance,
  markBookUpdated,
  monthCells,
  monthKey,
  monthTotals,
  reminderDue,
  reportRow,
  searchAll,
  setBudget,
  setProfile,
  setReminder,
  shiftMonth,
  todayKey,
} from './src/money.mjs';
import { emptySecurePart, mergeUnlocked, readDocument, securePart, toDocument } from './src/document.mjs';
import { readFirebaseConfig, signInWith, signOutCloud } from './src/firebase';
import { diaryOpenErrorMessage, providerLabel, signInErrorMessage } from './src/messages.mjs';
import { loadSavedTheme, saveTheme } from './src/preferences';
import { loadDiaryDocument, saveDiaryDocument } from './src/storage';
import { PALETTES, otherTheme, resolveTheme, themeButtonLabel } from './src/theme.mjs';
import { lockDiary, unlockDiary } from './src/vault.mjs';

const AREAS = [
  ['calendar', 'Calendar'],
  ['diary', 'Diary'],
  ['events', 'Events'],
  ['search', 'Search'],
  ['reports', 'Budget and reports'],
  ['accounts', 'Accounts'],
  ['notes', 'Secret notes'],
  ['reminder', 'Reminder'],
  ['profile', 'Profile and contacts'],
];
// These areas hold figures or secret notes. The diary password locks only these.
const SECURE_AREAS = ['diary', 'events', 'reports', 'accounts', 'notes'];
const ENTRY_TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function lkr(value) {
  if (value == null || value === '') return '—';
  return `LKR ${Number(value).toLocaleString('en-LK')}`;
}

function monthLabel(month) {
  const [year, index] = month.split('-');
  return `${MONTH_NAMES[Number(index) - 1]} ${year}`;
}

// Picks light or dark: the choice remembered on this browser, or else the device's own setting.
function useThemeChoice() {
  const device = useColorScheme();
  const [saved, setSaved] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadSavedTheme()
      .then(setSaved)
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  const name = resolveTheme(saved, device);
  useEffect(() => {
    // On web, this makes the browser's own parts, such as scrollbars, match the theme.
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.style.colorScheme = name;
  }, [name]);
  function toggle() {
    const next = otherTheme(name);
    setSaved(next);
    // If the browser refuses to store it, the choice still holds until the page is closed.
    saveTheme(next).catch(() => {});
  }
  return { theme: THEMES[name], ready, toggle };
}

export default function App() {
  const today = todayKey();
  const { theme, ready: themeReady, toggle: toggleTheme } = useThemeChoice();
  const styles = theme.styles;
  const [screen, setScreen] = useState('gate');
  const [account, setAccount] = useState(null);
  const [diary, setDiary] = useState(null);
  // The encrypted figures as saved, while they are still locked. Null once unlocked or when no password is set.
  const [lockedPack, setLockedPack] = useState(null);
  const [legacyLock, setLegacyLock] = useState(false);
  const [password, setPassword] = useState('');
  const [area, setArea] = useState('calendar');
  const [month, setMonth] = useState(monthKey(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState('');

  async function openAccount(nextAccount) {
    setBusy(true);
    setMessage('');
    try {
      // Signing in opens the diary straight away. A password, if one was set, is asked for only on the locked areas.
      const opened = readDocument(await loadDiaryDocument(nextAccount));
      setAccount(nextAccount);
      setPassword('');
      setLockedPack(opened.lockedPack);
      setLegacyLock(opened.legacy);
      setDiary(applyAccount(opened.diary, nextAccount));
      setArea('calendar');
      setScreen('main');
    } catch (error) {
      setMessage(diaryOpenErrorMessage(error, nextAccount));
    } finally {
      setBusy(false);
    }
  }

  // While the figures are still locked, `pack` is written back untouched, so a save never overwrites them.
  async function persist(next, secret = password, pack = lockedPack) {
    const secure = pack || (secret ? await lockDiary(securePart(next), secret) : { mode: 'plain', ...securePart(next) });
    await saveDiaryDocument(account, toDocument(next, secure));
    setDiary(next);
    setLegacyLock(false);
    setPending(null);
  }

  function save(next, secret, pack) {
    setBusy(true);
    setMessage('');
    return persist(next, secret, pack)
      .catch((error) => setMessage(error.message))
      .finally(() => setBusy(false));
  }

  function stage(next, financial = false) {
    if (financial && !password && !lockedPack) {
      setPending(next);
      return;
    }
    save(next);
  }

  async function unlockFigures(secret) {
    try {
      const unlocked = await unlockDiary(lockedPack, secret);
      setDiary(applyAccount(mergeUnlocked(diary, unlocked, legacyLock), account));
      setPassword(secret);
      setLockedPack(null);
      setMessage('');
    } catch (error) {
      setMessage('Wrong password. The saved figures were not changed.');
    }
  }

  async function eraseFigures() {
    setBusy(true);
    try {
      await persist({ ...diary, ...emptySecurePart() }, '', null);
      setPassword('');
      setLockedPack(null);
      setMessage('The locked figures and secret notes were erased. Your profile, contacts, and reminder were kept.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function lockFigures() {
    const pack = await lockDiary(securePart(diary), password);
    setLockedPack(pack);
    setLegacyLock(false);
    setPassword('');
    setDiary({ ...diary, ...emptySecurePart() });
  }

  // Saves `next` encrypted with a new password, and keeps that password only after the save worked.
  async function saveWithPassword(next, secret) {
    setBusy(true);
    setMessage('');
    try {
      await persist(next, secret, null);
      setPassword(secret);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (account?.mode === 'cloud') await signOutCloud().catch(() => {});
    setScreen('gate');
    setAccount(null);
    setDiary(null);
    setLockedPack(null);
    setPassword('');
    setPending(null);
    setMessage('');
  }

  async function chooseSignIn(providerName) {
    setMessage('');
    setSigningIn(providerName);
    let nextAccount;
    try {
      nextAccount = await signInWith(providerName);
    } catch (error) {
      const pageAddress = typeof window !== 'undefined' && window.location ? window.location.origin : '';
      setMessage(signInErrorMessage(error, providerName, pageAddress));
      return;
    } finally {
      setSigningIn('');
    }
    await openAccount(nextAccount);
  }

  // Wait for the remembered choice, so the page never shows the other theme for a moment first.
  if (!themeReady) return null;

  return (
    <ThemeContext.Provider value={theme}>
      <SafeAreaView style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.kicker}>BUDGET DINA POTHA</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${otherTheme(theme.name)} mode`}
              style={styles.themeButton}
              onPress={toggleTheme}
            >
              <Text style={styles.themeButtonText}>{themeButtonLabel(theme.name)}</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>Budget Dina Potha</Text>
          <Text style={styles.subtitle}>Sri Lanka 2027 calendar, income, expenses, and private notes. Amounts in LKR.</Text>
        </View>
        {message ? <Text style={styles.error}>{message}</Text> : null}
        {screen === 'gate' && (
          <Gate
            busy={busy}
            signingIn={signingIn}
            onLocal={() => openAccount({ mode: 'local', email: '' })}
            onSignIn={chooseSignIn}
            month={month}
            setMonth={setMonth}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}
        {screen === 'main' && diary && account && (
          <DiaryShell
            diary={diary}
            account={account}
            locked={Boolean(lockedPack)}
            hasPassword={Boolean(password)}
            area={area}
            setArea={setArea}
            month={month}
            setMonth={setMonth}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            stage={stage}
            onUnlock={unlockFigures}
            onErase={eraseFigures}
            onLock={lockFigures}
            onSetPassword={(secret) => saveWithPassword(diary, secret)}
            onSignOut={signOut}
          />
        )}
        {pending && (
          <SavePrompt
            onBack={() => setPending(null)}
            onPassword={(secret) => saveWithPassword(pending, secret)}
            onSkip={() => save(pending, '', null)}
          />
        )}
      </SafeAreaView>
    </ThemeContext.Provider>
  );
}

// Sign-in supplies an email and a name. They fill empty fields only, and the user can change both.
function applyAccount(diary, account) {
  let next = diary;
  if (account?.email && !next.reminder.email) {
    next = setReminder(next, next.reminder.interval, account.email, next.reminder.emailEnabled);
  }
  if (account?.name && !next.profile.name) {
    next = { ...next, profile: { ...next.profile, name: account.name } };
  }
  return next;
}

function Gate({ busy, signingIn, onLocal, onSignIn, month, setMonth, selectedDate, setSelectedDate }) {
  const styles = useStyles();
  const waiting = busy || Boolean(signingIn);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Open the diary</Text>
      <Button label="Continue with Google" primary disabled={waiting} onPress={() => onSignIn('google')} />
      <Button label="Continue with Microsoft" primary disabled={waiting} onPress={() => onSignIn('microsoft')} />
      <Button label="Continue on this browser" disabled={waiting} onPress={onLocal} />
      {signingIn ? (
        <Text style={styles.body}>A separate {providerLabel(signingIn)} window is open. Choose your account there. This page continues after that.</Text>
      ) : null}
      {busy && !signingIn ? <Text style={styles.body}>Opening the diary…</Text> : null}
      {!readFirebaseConfig() ? (
        <Text style={styles.body}>Google and Microsoft need the public Firebase web config in a local .env file.</Text>
      ) : null}
      <Text style={styles.body}>Continue on this browser keeps the diary on this device and does not upload it.</Text>
      <Text style={styles.sectionTitle}>Calendar</Text>
      <Text style={styles.body}>The Sri Lanka 2027 holiday calendar is open without signing in.</Text>
      <Calendar diary={emptyDiary()} month={month} setMonth={setMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
    </ScrollView>
  );
}

// Checks a new password typed twice. Returns the problem as a sentence, or '' when it is fine.
function passwordProblem(first, second) {
  if (first.length < 8) return 'Password must be at least 8 characters.';
  if (first !== second) return 'The two passwords do not match.';
  return '';
}

// Shown when figures or a secret note are about to be saved and no password is set. The password is optional.
function SavePrompt({ onBack, onPassword, onSkip }) {
  const styles = useStyles();
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [localMessage, setLocalMessage] = useState('');
  return (
    <View style={styles.modal}>
      <View style={styles.modalCard}>
        <Text style={styles.sectionTitle}>Protect your figures with a password?</Text>
        <Text style={styles.body}>
          A password is optional. It locks only your money figures and secret notes. Without one, anyone who can open this browser can read them. With Google or Microsoft sign-in, anyone who can open this Firebase project can read them too.
        </Text>
        <Text style={styles.body}>A forgotten password cannot be recovered. The locked figures can only be erased.</Text>
        <Field label="Password, at least 8 characters" value={first} onChangeText={setFirst} secureTextEntry />
        <Field label="Type it again" value={second} onChangeText={setSecond} secureTextEntry />
        {localMessage ? <Text style={styles.formError}>{localMessage}</Text> : null}
        <Button
          label="Set password and save"
          primary
          onPress={() => {
            const problem = passwordProblem(first, second);
            setLocalMessage(problem);
            if (!problem) onPassword(first);
          }}
        />
        <Button label="Save without a password" onPress={onSkip} />
        <Button label="Go back" onPress={onBack} />
      </View>
    </View>
  );
}

// Takes the place of a locked area until the password is entered.
function LockedPanel({ onUnlock, onErase }) {
  const styles = useStyles();
  const [secret, setSecret] = useState('');
  const [confirmErase, setConfirmErase] = useState(false);
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>These figures are locked</Text>
      <Text style={styles.body}>Enter the diary password to open your money entries, events, budgets, accounts, and secret notes.</Text>
      <Field label="Password" value={secret} onChangeText={setSecret} secureTextEntry />
      <Button label="Unlock" primary onPress={() => onUnlock(secret)} />
      <Text style={styles.body}>A forgotten password cannot be recovered. Erasing the locked figures is the only way to start them again.</Text>
      {confirmErase ? (
        <View style={styles.inlineRow}>
          <Button label="Yes, erase the locked figures" onPress={onErase} />
          <Button label="Keep them" onPress={() => setConfirmErase(false)} />
        </View>
      ) : (
        <Button label="Erase the locked figures and start again" onPress={() => setConfirmErase(true)} />
      )}
    </View>
  );
}

function DiaryShell({
  diary, account, locked, hasPassword, area, setArea, month, setMonth, selectedDate, setSelectedDate,
  stage, onUnlock, onErase, onLock, onSetPassword, onSignOut,
}) {
  const styles = useStyles();
  const due = reminderDue(diary.reminder);
  const cloud = account.mode === 'cloud';
  const lockedArea = locked && SECURE_AREAS.includes(area);
  return (
    <View style={styles.main}>
      <ScrollView horizontal style={styles.tabBar} contentContainerStyle={styles.tabs}>
        {AREAS.map(([id, label]) => (
          <Pressable key={id} onPress={() => setArea(id)} style={[styles.tab, area === id && styles.tabOn]}>
            <Text style={[styles.tabText, area === id && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.row}>
        <Text style={styles.hint}>{cloud ? `Signed in as ${account.email}` : 'Diary kept on this browser'}</Text>
        {hasPassword ? <Button label="Lock figures" onPress={onLock} /> : null}
        {!locked ? <ChangePassword hasPassword={hasPassword} onChangePassword={onSetPassword} /> : null}
        <Button label={cloud ? 'Sign out' : 'Close diary'} onPress={onSignOut} />
      </View>
      {due && area !== 'reminder' ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>It is time to update the book.</Text>
          <Button label="Dismiss" onPress={() => stage(markBookUpdated(diary))} />
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.content}>
        {lockedArea ? <LockedPanel onUnlock={onUnlock} onErase={onErase} /> : null}
        {area === 'calendar' && locked ? (
          <Text style={styles.body}>Your entries and events are locked, so only holidays show here. Unlock them on the Diary tab.</Text>
        ) : null}
        {area === 'calendar' && (
          <Calendar diary={diary} month={month} setMonth={setMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
        )}
        {!lockedArea && area === 'diary' && <DiaryBook diary={diary} month={month} setMonth={setMonth} stage={stage} />}
        {!lockedArea && area === 'events' && <Events diary={diary} stage={stage} />}
        {area === 'search' && (
          <Search
            diary={diary}
            locked={locked}
            onHoliday={(date) => { setSelectedDate(date); setMonth(monthKey(date)); setArea('calendar'); }}
            onContact={() => setArea('profile')}
          />
        )}
        {!lockedArea && area === 'reports' && <Reports diary={diary} month={month} stage={stage} />}
        {!lockedArea && area === 'accounts' && <Accounts diary={diary} stage={stage} />}
        {!lockedArea && area === 'notes' && <Notes diary={diary} stage={stage} />}
        {area === 'reminder' && <Reminder diary={diary} stage={stage} due={due} />}
        {area === 'profile' && <Profile diary={diary} stage={stage} cloud={cloud} />}
      </ScrollView>
    </View>
  );
}

function Calendar({ diary, month, setMonth, selectedDate, setSelectedDate }) {
  const styles = useStyles();
  const [year, monthIndex] = month.split('-').map(Number);
  const cells = monthCells(year, monthIndex - 1);
  const selected = dayRecord(diary, HOLIDAYS_2027, selectedDate);
  return (
    <View>
      <MonthBar month={month} setMonth={setMonth} />
      <View style={styles.weekRow}>
        {WEEKDAYS.map((day) => <Text key={day} style={styles.weekDay}>{day}</Text>)}
      </View>
      <View style={styles.grid}>
        {cells.map((date, index) => {
          if (!date) return <View key={`empty-${index}`} style={styles.dayEmpty} />;
          const record = dayRecord(diary, HOLIDAYS_2027, date);
          return (
            <Pressable key={date} style={[styles.day, date === selectedDate && styles.dayOn, record.holiday && styles.dayHoliday]} onPress={() => setSelectedDate(date)}>
              <Text style={styles.dayNum}>{Number(date.slice(-2))}</Text>
              {record.holiday ? <Text style={styles.dayMark}>{record.holiday.types.join(' ')}</Text> : null}
              {record.weekend && !record.holiday ? <Text style={styles.dayMark}>B</Text> : null}
              {record.entries.length > 0 ? <Text style={styles.dayMark}>Rs</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{selectedDate}</Text>
        {selected.holiday ? (
          <Text style={styles.body}>{selected.holiday.name}{'\n'}{selected.holiday.sinhalaName} ({selected.holiday.types.join(', ')})</Text>
        ) : null}
        {selected.weekend ? <Text style={styles.body}>Saturday and Sunday are bank holidays.</Text> : null}
        {selected.events.map((event) => <Text key={event.id} style={styles.body}>{event.title} · {event.kind} · planned {lkr(event.plannedCost)}</Text>)}
        {selected.entries.map((entry) => <Text key={entry.id} style={styles.body}>{entry.type}: {lkr(entry.amount)} {entry.note}</Text>)}
        {!selected.holiday && selected.entries.length === 0 && selected.events.length === 0 ? <Text style={styles.body}>Nothing is recorded on this day.</Text> : null}
      </View>
    </View>
  );
}

function DiaryBook({ diary, month, setMonth, stage }) {
  const styles = useStyles();
  const totals = monthTotals(diary, month);
  const [type, setType] = useState('expense');
  const [formError, setFormError] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('expense-food');
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState('');
  const [eventId, setEventId] = useState('');
  const categories = diary.categories.filter((category) => category.kind === type);
  const categoryNames = Object.fromEntries(diary.categories.map((category) => [category.id, category.name]));
  return (
    <View>
      <MonthBar month={month} setMonth={setMonth} />
      <View style={styles.summaryRow}>
        <Summary label="Income" value={lkr(totals.income)} />
        <Summary label="Expenses" value={lkr(totals.expenses)} />
        <Summary label="Balance" value={lkr(totals.balance)} />
        <Summary label="Budget left" value={lkr(totals.budgetLeft)} />
      </View>
      <Dropdown
        label="Type"
        value={type}
        options={ENTRY_TYPES}
        onChange={(value) => {
          if (value === type) return;
          // The category list follows the type, so start from that type's first category.
          setType(value);
          setCategoryId(value === 'income' ? 'income-salary' : 'expense-food');
        }}
      />
      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Dropdown
        label="Category"
        placeholder="Choose a category"
        value={categoryId}
        options={categories.map((category) => ({ value: category.id, label: category.name }))}
        onChange={setCategoryId}
        addLabel="+ Add a new category"
        addFieldLabel={`New ${type} category name`}
        addButtonLabel="Add category"
        onAdd={(name) => {
          // The new category is chosen for this entry straight away.
          const added = addCategory(diary, name, type);
          stage(added.diary, true);
          setCategoryId(added.category.id);
        }}
      />
      <DateField label="Date" value={date} onChange={setDate} />
      <Field label="Note" value={note} onChangeText={setNote} />
      <Field label="Event id, optional" value={eventId} onChangeText={setEventId} />
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <Button
        label="Save entry"
        primary
        onPress={() => {
          try {
            stage(markBookUpdated(addEntry(diary, { type, amount, categoryId, date, note, eventId })), true);
            setFormError('');
            setAmount('');
            setNote('');
          } catch (error) {
            setFormError(error.message);
          }
        }}
      />
      {diary.entries.filter((entry) => monthKey(entry.date) === month).map((entry) => (
        <View key={entry.id} style={styles.card}>
          <Text style={styles.cardTitle}>{entry.date} · {entry.type} · {lkr(entry.amount)}</Text>
          <Text style={styles.body}>{entry.note || 'No note'} · {categoryNames[entry.categoryId] || entry.categoryId}</Text>
          <Button label="Delete" onPress={() => stage(deleteEntry(diary, entry.id), true)} />
        </View>
      ))}
    </View>
  );
}

function Events({ diary, stage }) {
  const styles = useStyles();
  const [formError, setFormError] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('trip');
  const [startDate, setStartDate] = useState(todayKey());
  const [endDate, setEndDate] = useState(todayKey());
  const [plannedCost, setPlannedCost] = useState('');
  const [note, setNote] = useState('');
  return (
    <View>
      <Field label="Title" value={title} onChangeText={setTitle} />
      <Field label="Kind: trip, meetup, office, other" value={kind} onChangeText={setKind} />
      <DateField
        label="Start date"
        value={startDate}
        onChange={(value) => {
          setStartDate(value);
          // An event cannot end before it starts.
          if (endDate < value) setEndDate(value);
        }}
      />
      <DateField
        label="End date"
        value={endDate}
        onChange={(value) => {
          setEndDate(value);
          if (value < startDate) setStartDate(value);
        }}
      />
      <Field label="Planned cost" value={plannedCost} onChangeText={setPlannedCost} keyboardType="decimal-pad" />
      <Field label="Note" value={note} onChangeText={setNote} />
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <Button
        label="Save event"
        primary
        onPress={() => {
          try {
            const next = markBookUpdated(addEvent(diary, { title, kind, startDate, endDate, plannedCost, note }));
            setFormError('');
            stage(next, true);
            setTitle('');
            setPlannedCost('');
            setNote('');
          } catch (error) {
            setFormError(error.message);
          }
        }}
      />
      {diary.events.map((event) => {
        const summary = eventSummary(diary, event);
        return (
          <View key={event.id} style={styles.card}>
            <Text style={styles.cardTitle}>{event.title}</Text>
            <Text style={styles.body}>{event.kind} · {event.startDate} to {event.endDate}</Text>
            <Text style={styles.body}>Planned {lkr(summary.planned)} · Spent {lkr(summary.spent)} · Left {lkr(summary.left)}</Text>
            <Text style={styles.hint}>Event id: {event.id}</Text>
            <Button label="Delete event" onPress={() => stage(deleteEvent(diary, event.id), true)} />
          </View>
        );
      })}
    </View>
  );
}

function Search({ diary, locked, onHoliday, onContact }) {
  const styles = useStyles();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchAll(diary, HOLIDAYS_2027, query), [diary, query]);
  return (
    <View style={styles.stack}>
      <Field label="Search holidays, contacts, events, notes, and entries" value={query} onChangeText={setQuery} />
      {locked ? (
        <Text style={styles.body}>Events, notes, and money entries are locked, so this search covers holidays and contacts only. Unlock them on the Diary tab.</Text>
      ) : null}
      <ResultGroup title="Holidays" items={results.holidays} render={(holiday) => holiday.name} onPress={(holiday) => onHoliday(holiday.date)} />
      <ResultGroup title="Contacts" items={results.contacts} render={(contact) => [contact.name, contact.phone].filter(Boolean).join(' · ')} onPress={onContact} />
      <ResultGroup title="Events" items={results.events} render={(event) => event.title} />
      <ResultGroup title="Notes" items={results.notes} render={(note) => note.title || note.body} />
      <ResultGroup title="Money entries" items={results.entries} render={(entry) => `${entry.date} ${entry.note}`} />
    </View>
  );
}

function Reports({ diary, month, stage }) {
  const styles = useStyles();
  const rows = [-2, -1, 0, 1, 2].map((delta) => reportRow(diary, shiftMonth(month, delta), monthKey(todayKey())));
  const [spendingBudget, setSpendingBudget] = useState('');
  const [plannedIncome, setPlannedIncome] = useState('');
  return (
    <View>
      <Text style={styles.sectionTitle}>Budget for {monthLabel(month)}</Text>
      <Field label="Spending budget" value={spendingBudget} onChangeText={setSpendingBudget} keyboardType="decimal-pad" />
      <Field label="Planned income" value={plannedIncome} onChangeText={setPlannedIncome} keyboardType="decimal-pad" />
      <Button label="Save budget" primary onPress={() => stage(setBudget(diary, month, spendingBudget, plannedIncome), true)} />
      {rows.map((row) => (
        <View key={row.month} style={styles.card}>
          <Text style={styles.cardTitle}>{monthLabel(row.month)}{row.future ? ' · plan' : ''}</Text>
          <Text style={styles.body}>Income {lkr(row.income)} · Expenses {lkr(row.expenses)} · Balance {lkr(row.balance)}</Text>
          <Text style={styles.body}>Budget {lkr(row.spendingBudget)} · Planned income {lkr(row.plannedIncome)} · Budget left {lkr(row.budgetLeft)}</Text>
        </View>
      ))}
    </View>
  );
}

function Accounts({ diary, stage }) {
  const styles = useStyles();
  const [formError, setFormError] = useState('');
  const [nickname, setNickname] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [balance, setBalance] = useState('');
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState('');
  return (
    <View>
      <Text style={styles.body}>Store a nickname and bank name. Do not enter a card number, full account number, PIN, or banking password.</Text>
      <Field label="Nickname" value={nickname} onChangeText={setNickname} />
      <Field label="Bank name" value={bankName} onChangeText={setBankName} />
      <Button
        label="Add account"
        primary
        onPress={() => {
          try {
            const next = addAccount(diary, { nickname, bankName });
            setFormError('');
            stage(next, true);
            setNickname('');
            setBankName('');
          } catch (error) {
            setFormError(error.message);
          }
        }}
      />
      <Field label="Account id" value={accountId} onChangeText={setAccountId} />
      <Field label="Balance" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" />
      <DateField label="Date" value={date} onChange={setDate} />
      <Field label="Note" value={note} onChangeText={setNote} />
      <Button
        label="Save balance update"
        primary
        onPress={() => {
          try {
            stage(markBookUpdated(addBalanceUpdate(diary, { accountId, balance, date, note })), true);
            setFormError('');
            setBalance('');
            setNote('');
          } catch (error) {
            setFormError(error.message);
          }
        }}
      />
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      {diary.accounts.map((account) => {
        const latest = latestBalance(diary, account.id);
        return (
          <View key={account.id} style={styles.card}>
            <Text style={styles.cardTitle}>{account.nickname} · {account.bankName}</Text>
            <Text style={styles.body}>Latest balance {latest ? `${lkr(latest.balance)} on ${latest.date}` : '—'}</Text>
            <Text style={styles.hint}>Account id: {account.id}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Notes({ diary, stage }) {
  const styles = useStyles();
  const [formError, setFormError] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  return (
    <View>
      <Field label="Title" value={title} onChangeText={setTitle} />
      <Field label="Note" value={body} onChangeText={setBody} />
      <Button
        label="Save note"
        primary
        onPress={() => {
          try {
            stage(addNote(diary, { title, body }), true);
            setFormError('');
            setTitle('');
            setBody('');
          } catch (error) {
            setFormError(error.message);
          }
        }}
      />
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      {diary.notes.map((note) => (
        <View key={note.id} style={styles.card}>
          <Text style={styles.cardTitle}>{note.title || 'Untitled'}</Text>
          <Text style={styles.body}>{note.body}</Text>
          <Button label="Delete" onPress={() => stage(deleteNote(diary, note.id), true)} />
        </View>
      ))}
    </View>
  );
}

function Reminder({ diary, stage, due }) {
  const styles = useStyles();
  const [interval, setInterval] = useState(diary.reminder.interval);
  const [email, setEmail] = useState(diary.reminder.email);
  const [emailEnabled, setEmailEnabled] = useState(diary.reminder.emailEnabled ? 'yes' : 'no');
  return (
    <View>
      {due ? <Text style={styles.bannerText}>It is time to update the book.</Text> : <Text style={styles.body}>The book is up to date for this interval.</Text>}
      <Field label="Interval: daily, weekly, or monthly" value={interval} onChangeText={setInterval} />
      <Field label="Email address" value={email} onChangeText={setEmail} />
      <Field label="Email reminders on? yes or no" value={emailEnabled} onChangeText={setEmailEnabled} />
      <Text style={styles.body}>The address is saved for later. This version does not send email.</Text>
      <Button label="Save reminder" primary onPress={() => stage(setReminder(diary, interval, email, emailEnabled === 'yes'))} />
      <Button label="I updated the book" onPress={() => stage(markBookUpdated(diary))} />
    </View>
  );
}

function ChangePassword({ hasPassword, onChangePassword }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [nextSecret, setNextSecret] = useState('');
  const [again, setAgain] = useState('');
  const [localMessage, setLocalMessage] = useState('');
  function close() {
    setOpen(false);
    setNextSecret('');
    setAgain('');
    setLocalMessage('');
  }
  if (!open) return <Button label={hasPassword ? 'Change password' : 'Set a password'} onPress={() => setOpen(true)} />;
  return (
    <View style={styles.card}>
      <Text style={styles.body}>The password locks only your money figures and secret notes. A forgotten password cannot be recovered.</Text>
      <Field label="New password, at least 8 characters" value={nextSecret} onChangeText={setNextSecret} secureTextEntry />
      <Field label="Type it again" value={again} onChangeText={setAgain} secureTextEntry />
      {localMessage ? <Text style={styles.formError}>{localMessage}</Text> : null}
      <View style={styles.inlineRow}>
        <Button
          label="Save password"
          primary
          onPress={() => {
            const problem = passwordProblem(nextSecret, again);
            setLocalMessage(problem);
            if (problem) return;
            onChangePassword(nextSecret);
            close();
          }}
        />
        <Button label="Cancel" onPress={close} />
      </View>
    </View>
  );
}

function Profile({ diary, stage, cloud }) {
  const styles = useStyles();
  const [name, setName] = useState(diary.profile.name);
  const [phone, setPhone] = useState(diary.profile.phone);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactNote, setContactNote] = useState('');
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);
  return (
    <View style={styles.stack}>
      <Text style={styles.sectionTitle}>Your details</Text>
      <Text style={styles.body}>
        Your name, phone number, and contacts are not locked by the diary password.{' '}
        {cloud ? 'They are saved to your own account, which only you can open.' : 'They stay on this browser.'}
      </Text>
      <Field label="Name" value={name} onChangeText={(value) => { setName(value); setSaved(false); }} />
      <Field label="Phone number" value={phone} onChangeText={(value) => { setPhone(value); setSaved(false); }} keyboardType="phone-pad" />
      <Button
        label="Save details"
        primary
        onPress={() => {
          try {
            stage(setProfile(diary, { name, phone }));
            setFormError('');
            setSaved(true);
          } catch (error) {
            setFormError(error.message);
          }
        }}
      />
      {saved ? <Text style={styles.body}>Details saved.</Text> : null}
      <Text style={styles.sectionTitle}>Contacts</Text>
      <Field label="Contact name" value={contactName} onChangeText={setContactName} />
      <Field label="Contact phone number" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
      <Field label="Note, optional" value={contactNote} onChangeText={setContactNote} />
      <Button
        label="Add contact"
        primary
        onPress={() => {
          try {
            stage(addContact(diary, { name: contactName, phone: contactPhone, note: contactNote }));
            setFormError('');
            setContactName('');
            setContactPhone('');
            setContactNote('');
          } catch (error) {
            setFormError(error.message);
          }
        }}
      />
      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      {diary.contacts.length === 0 ? <Text style={styles.body}>No contacts yet.</Text> : null}
      {diary.contacts.map((contact) => (
        <View key={contact.id} style={styles.card}>
          <Text style={styles.cardTitle}>{contact.name}</Text>
          <Text style={styles.body}>{[contact.phone, contact.note].filter(Boolean).join(' · ') || 'No phone number or note'}</Text>
          <Button label="Delete" onPress={() => stage(deleteContact(diary, contact.id))} />
        </View>
      ))}
    </View>
  );
}

function MonthBar({ month, setMonth }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Button label="Previous" onPress={() => setMonth(shiftMonth(month, -1))} />
      <Text style={styles.sectionTitle}>{monthLabel(month)}</Text>
      <Button label="Next" onPress={() => setMonth(shiftMonth(month, 1))} />
    </View>
  );
}

function ResultGroup({ title, items, render, onPress }) {
  const styles = useStyles();
  if (!items.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {items.map((item) => (
        <Pressable key={item.id || item.date} onPress={() => onPress && onPress(item)}>
          <Text style={styles.body}>{render(item)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Summary({ label, value }) {
  const styles = useStyles();
  return (
    <View style={styles.summary}>
      <Text style={styles.hint}>{label}</Text>
      <Text style={styles.cardTitle}>{value}</Text>
    </View>
  );
}

function Field(props) {
  const { styles, colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.hint}>{props.label}</Text>
      <TextInput {...props} style={styles.input} placeholderTextColor={colors.placeholder} />
    </View>
  );
}

function dateLabel(date) {
  const [year, month, day] = String(date).split('-').map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return `${weekday}, ${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

// A date box that opens a month grid in place under it. The value stays `YYYY-MM-DD`.
function DateField({ label, value, onChange }) {
  const styles = useStyles();
  const today = todayKey();
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(monthKey(value || today));
  const [year, monthIndex] = viewMonth.split('-').map(Number);
  function pick(date) {
    onChange(date);
    setOpen(false);
  }
  return (
    <View style={styles.field}>
      <Text style={styles.hint}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        style={styles.select}
        onPress={() => {
          // Always open on the month of the chosen date.
          setViewMonth(monthKey(value || today));
          setOpen(!open);
        }}
      >
        <Text style={value ? styles.selectText : styles.selectPlaceholder}>{value ? dateLabel(value) : 'Choose a date'}</Text>
        <Text style={styles.selectArrow}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.datePanel}>
          <MonthBar month={viewMonth} setMonth={setViewMonth} />
          <View style={styles.weekRow}>
            {WEEKDAYS.map((day) => <Text key={day} style={styles.weekDay}>{day}</Text>)}
          </View>
          <View style={styles.grid}>
            {monthCells(year, monthIndex - 1).map((date, index) => {
              if (!date) return <View key={`empty-${index}`} style={styles.dateCellEmpty} />;
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={dateLabel(date)}
                  style={[styles.dateCell, date === today && styles.dateCellToday, date === value && styles.dateCellOn]}
                  onPress={() => pick(date)}
                >
                  <Text style={[styles.dateCellText, date === value && styles.dateCellTextOn]}>{Number(date.slice(-2))}</Text>
                </Pressable>
              );
            })}
          </View>
          <Button label="Today" onPress={() => pick(today)} />
        </View>
      ) : null}
    </View>
  );
}

// A pick-one list that opens in place under its box, so it works the same on web and on a phone.
// With `onAdd`, the last choice opens a small form for a new option. `onAdd` may throw to refuse a name.
function Dropdown({ label, value, options, onChange, placeholder, addLabel, addFieldLabel, addButtonLabel, onAdd }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [localMessage, setLocalMessage] = useState('');
  const selected = options.find((option) => option.value === value);
  function closeAdd() {
    setAdding(false);
    setNewName('');
    setLocalMessage('');
  }
  return (
    <View style={styles.field}>
      <Text style={styles.hint}>{label}</Text>
      <Pressable accessibilityRole="button" style={styles.select} onPress={() => setOpen(!open)}>
        <Text style={selected ? styles.selectText : styles.selectPlaceholder}>{selected ? selected.label : placeholder}</Text>
        <Text style={styles.selectArrow}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.selectList}>
          {options.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.selectOption, option.value === value && styles.selectOptionOn]}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
                closeAdd();
              }}
            >
              <Text style={styles.selectText}>{option.label}</Text>
            </Pressable>
          ))}
          {onAdd ? (
            <Pressable style={styles.selectOption} onPress={() => { setAdding(true); setOpen(false); }}>
              <Text style={styles.selectAdd}>{addLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {adding ? (
        <View style={styles.card}>
          <Field label={addFieldLabel} value={newName} onChangeText={setNewName} />
          {localMessage ? <Text style={styles.formError}>{localMessage}</Text> : null}
          <View style={styles.inlineRow}>
            <Button
              label={addButtonLabel}
              primary
              onPress={() => {
                try {
                  onAdd(newName);
                  closeAdd();
                } catch (error) {
                  setLocalMessage(error.message);
                }
              }}
            />
            <Button label="Cancel" onPress={closeAdd} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Button({ label, onPress, primary, disabled }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.button, primary && styles.buttonPrimary, disabled && styles.buttonDisabled]}>
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

// Every colour comes from a palette in `src/theme.mjs`. Do not write a colour into a component.
function makeStyles(c) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: c.page },
    header: { backgroundColor: c.headerBg, padding: 20 },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    kicker: { color: c.headerKicker, fontSize: 12, fontWeight: '800' },
    themeButton: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: c.headerButtonBg },
    themeButtonText: { color: c.headerButtonText, fontSize: 12, fontWeight: '800' },
    title: { color: c.headerTitle, fontSize: 28, fontWeight: '900', marginTop: 4 },
    subtitle: { color: c.headerText, marginTop: 6 },
    content: { padding: 16, gap: 10, paddingBottom: 40 },
    main: { flex: 1 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: c.text },
    body: { color: c.textBody, lineHeight: 20 },
    hint: { color: c.textHint, fontSize: 12 },
    error: { color: c.error, paddingHorizontal: 16, paddingTop: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 8 },
    // The tab row keeps its own height. Without this it grows to fill a short page and the tabs stretch.
    tabBar: { flexGrow: 0, flexShrink: 0 },
    tabs: { gap: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
    stack: { gap: 10 },
    inlineRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    formError: { color: c.error },
    tab: { borderRadius: 999, backgroundColor: c.control, paddingHorizontal: 12, paddingVertical: 8 },
    tabOn: { backgroundColor: c.accent },
    tabText: { color: c.textBody, fontWeight: '700' },
    tabTextOn: { color: c.onAccent },
    card: { backgroundColor: c.surface, borderRadius: 14, padding: 12, gap: 6, borderWidth: 1, borderColor: c.border },
    cardTitle: { fontWeight: '800', color: c.text },
    field: { gap: 4 },
    input: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 10, color: c.text },
    select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.surface, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 10 },
    selectText: { color: c.text },
    selectPlaceholder: { color: c.placeholder },
    selectArrow: { color: c.textHint, fontSize: 10 },
    selectList: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, overflow: 'hidden' },
    selectOption: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: c.divider },
    selectOptionOn: { backgroundColor: c.highlight },
    selectAdd: { color: c.accentText, fontWeight: '800' },
    button: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: c.control, alignItems: 'center' },
    buttonPrimary: { backgroundColor: c.accent },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontWeight: '800', color: c.text },
    buttonTextPrimary: { color: c.onAccent },
    banner: { margin: 16, padding: 12, borderRadius: 12, backgroundColor: c.bannerBg, gap: 8 },
    bannerText: { color: c.bannerText, fontWeight: '800' },
    summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    summary: { backgroundColor: c.surface, borderRadius: 12, padding: 10, minWidth: 140 },
    weekRow: { flexDirection: 'row' },
    weekDay: { width: '14.28%', textAlign: 'center', fontWeight: '800', color: c.textHint },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    day: { width: '14.28%', minHeight: 64, padding: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    dayEmpty: { width: '14.28%', minHeight: 64 },
    dayOn: { borderColor: c.accent, borderWidth: 2 },
    dayHoliday: { backgroundColor: c.holidayBg },
    dayNum: { fontWeight: '800', color: c.text },
    dayMark: { fontSize: 10, color: c.holidayMark, fontWeight: '700' },
    datePanel: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 8, gap: 8 },
    dateCell: { width: '14.28%', height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
    dateCellEmpty: { width: '14.28%', height: 40 },
    dateCellToday: { borderColor: c.accent },
    dateCellOn: { backgroundColor: c.accent },
    dateCellText: { color: c.text, fontWeight: '700' },
    dateCellTextOn: { color: c.onAccent },
    modal: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: c.backdrop, justifyContent: 'center', padding: 20 },
    modalCard: { backgroundColor: c.surface, borderRadius: 16, padding: 16, gap: 12 },
  });
}

// One ready-made set of styles per palette. The current one reaches every component through context.
const THEMES = Object.fromEntries(
  Object.entries(PALETTES).map(([name, colors]) => [name, { name, colors, styles: makeStyles(colors) }]),
);
const ThemeContext = createContext(THEMES.light);

function useTheme() {
  return useContext(ThemeContext);
}

function useStyles() {
  return useTheme().styles;
}
