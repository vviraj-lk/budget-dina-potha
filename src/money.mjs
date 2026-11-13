export const INTERVALS = ['daily', 'weekly', 'monthly'];

const INTERVAL_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

export function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultCategories() {
  return [
    { id: 'income-salary', name: 'Salary', kind: 'income' },
    { id: 'income-bonus', name: 'Bonus', kind: 'income' },
    { id: 'income-other', name: 'Other', kind: 'income' },
    { id: 'expense-food', name: 'Food', kind: 'expense' },
    { id: 'expense-transport', name: 'Transport', kind: 'expense' },
    { id: 'expense-bills', name: 'Bills', kind: 'expense' },
    { id: 'expense-shopping', name: 'Shopping', kind: 'expense' },
    { id: 'expense-health', name: 'Health', kind: 'expense' },
    { id: 'expense-other', name: 'Other', kind: 'expense' },
  ];
}

export function emptyDiary() {
  return {
    categories: defaultCategories(),
    entries: [],
    events: [],
    budgets: {},
    accounts: [],
    balanceUpdates: [],
    notes: [],
    reminder: {
      interval: 'monthly',
      email: '',
      emailEnabled: false,
      lastBookUpdate: null,
    },
    profile: { name: '', phone: '' },
    contacts: [],
  };
}

function phoneNumber(value) {
  const phone = String(value || '').trim();
  if (phone && !/^\+?[\d\s()-]{5,20}$/.test(phone)) {
    throw new Error('A phone number can use digits, spaces, +, -, and brackets.');
  }
  return phone;
}

export function setProfile(diary, input) {
  return { ...diary, profile: { name: String(input.name || '').trim(), phone: phoneNumber(input.phone) } };
}

export function addContact(diary, input) {
  const contact = {
    id: input.id || createId(),
    name: String(input.name || '').trim(),
    phone: phoneNumber(input.phone),
    note: String(input.note || '').trim(),
  };
  if (!contact.name) throw new Error('A contact needs a name.');
  const existing = diary.contacts || [];
  const contacts = existing.some((item) => item.id === contact.id)
    ? existing.map((item) => (item.id === contact.id ? contact : item))
    : [...existing, contact];
  return { ...diary, contacts };
}

export function deleteContact(diary, id) {
  return { ...diary, contacts: (diary.contacts || []).filter((contact) => contact.id !== id) };
}

export function monthKey(date) {
  return String(date).slice(0, 7);
}

export function shiftMonth(month, delta) {
  const [year, monthIndex] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function todayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

function sum(entries) {
  return money(entries.reduce((total, entry) => total + money(entry.amount), 0));
}

export function monthTotals(diary, month) {
  const entries = diary.entries.filter((entry) => monthKey(entry.date) === month);
  const income = sum(entries.filter((entry) => entry.type === 'income'));
  const expenses = sum(entries.filter((entry) => entry.type === 'expense'));
  const budget = diary.budgets[month];
  const hasBudget = budget && budget.spendingBudget !== '' && budget.spendingBudget != null;
  return {
    income,
    expenses,
    balance: money(income - expenses),
    budgetLeft: hasBudget ? money(money(budget.spendingBudget) - expenses) : null,
  };
}

export function addCategory(diary, name, kind) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Category name is required.');
  if (kind !== 'income' && kind !== 'expense') throw new Error('Type must be income or expense before adding a category.');
  const taken = diary.categories.some((item) => item.kind === kind && item.name.toLowerCase() === trimmed.toLowerCase());
  if (taken) throw new Error(`There is already ${kind === 'income' ? 'an income' : 'an expense'} category called ${trimmed}.`);
  const category = { id: createId(), name: trimmed, kind };
  return { diary: { ...diary, categories: [...diary.categories, category] }, category };
}

export function addEntry(diary, input) {
  const amount = money(input.amount);
  if (!(amount > 0)) throw new Error('Amount must be greater than zero.');
  const category = diary.categories.find((item) => item.id === input.categoryId);
  if (!category || category.kind !== input.type) throw new Error('Category does not match the entry type.');
  const entry = {
    id: input.id || createId(),
    date: input.date,
    type: input.type,
    amount,
    categoryId: input.categoryId,
    note: String(input.note || '').trim(),
    eventId: input.eventId || '',
  };
  const entries = diary.entries.some((item) => item.id === entry.id)
    ? diary.entries.map((item) => (item.id === entry.id ? entry : item))
    : [entry, ...diary.entries];
  return { ...diary, entries };
}

export function deleteEntry(diary, id) {
  return { ...diary, entries: diary.entries.filter((entry) => entry.id !== id) };
}

export function addEvent(diary, input) {
  const plannedCost = money(input.plannedCost);
  if (!(plannedCost >= 0)) throw new Error('Planned cost must be zero or more.');
  const event = {
    id: input.id || createId(),
    title: String(input.title || '').trim(),
    kind: input.kind,
    startDate: input.startDate,
    endDate: input.endDate || input.startDate,
    plannedCost,
    note: String(input.note || '').trim(),
  };
  if (!event.title) throw new Error('Event title is required.');
  if (!['trip', 'meetup', 'office', 'other'].includes(event.kind)) throw new Error('Event kind is invalid.');
  const events = diary.events.some((item) => item.id === event.id)
    ? diary.events.map((item) => (item.id === event.id ? event : item))
    : [event, ...diary.events];
  return { ...diary, events };
}

export function deleteEvent(diary, id) {
  return {
    ...diary,
    events: diary.events.filter((event) => event.id !== id),
    entries: diary.entries.map((entry) => (entry.eventId === id ? { ...entry, eventId: '' } : entry)),
  };
}

export function eventSummary(diary, event) {
  const spent = sum(diary.entries.filter((entry) => entry.eventId === event.id && entry.type === 'expense'));
  return { planned: money(event.plannedCost), spent, left: money(money(event.plannedCost) - spent) };
}

export function setBudget(diary, month, spendingBudget, plannedIncome) {
  const next = { ...diary.budgets };
  const budget = {};
  if (spendingBudget !== '' && spendingBudget != null) budget.spendingBudget = money(spendingBudget);
  if (plannedIncome !== '' && plannedIncome != null) budget.plannedIncome = money(plannedIncome);
  if (Object.keys(budget).length === 0) delete next[month];
  else next[month] = budget;
  return { ...diary, budgets: next };
}

export function addAccount(diary, input) {
  const account = {
    id: input.id || createId(),
    nickname: String(input.nickname || '').trim(),
    bankName: String(input.bankName || '').trim(),
  };
  if (!account.nickname) throw new Error('Account nickname is required.');
  const accounts = diary.accounts.some((item) => item.id === account.id)
    ? diary.accounts.map((item) => (item.id === account.id ? account : item))
    : [...diary.accounts, account];
  return { ...diary, accounts };
}

export function addBalanceUpdate(diary, input) {
  const update = {
    id: input.id || createId(),
    accountId: input.accountId,
    date: input.date,
    balance: money(input.balance),
    note: String(input.note || '').trim(),
  };
  if (!diary.accounts.some((account) => account.id === update.accountId)) throw new Error('Account is required.');
  const balanceUpdates = diary.balanceUpdates.some((item) => item.id === update.id)
    ? diary.balanceUpdates.map((item) => (item.id === update.id ? update : item))
    : [update, ...diary.balanceUpdates];
  return { ...diary, balanceUpdates };
}

export function latestBalance(diary, accountId) {
  const updates = diary.balanceUpdates
    .filter((update) => update.accountId === accountId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return updates[0] || null;
}

export function addNote(diary, input) {
  const note = {
    id: input.id || createId(),
    updatedAt: input.updatedAt || new Date().toISOString(),
    title: String(input.title || '').trim(),
    body: String(input.body || '').trim(),
  };
  if (!note.title && !note.body) throw new Error('A note needs a title or some text.');
  const notes = diary.notes.some((item) => item.id === note.id)
    ? diary.notes.map((item) => (item.id === note.id ? note : item))
    : [note, ...diary.notes];
  return { ...diary, notes };
}

export function deleteNote(diary, id) {
  return { ...diary, notes: diary.notes.filter((note) => note.id !== id) };
}

export function setReminder(diary, interval, email, emailEnabled) {
  if (!INTERVALS.includes(interval)) throw new Error('Reminder interval is invalid.');
  return {
    ...diary,
    reminder: {
      ...diary.reminder,
      interval,
      email: String(email || '').trim(),
      emailEnabled: Boolean(emailEnabled),
    },
  };
}

export function markBookUpdated(diary, now = new Date()) {
  return { ...diary, reminder: { ...diary.reminder, lastBookUpdate: now.toISOString() } };
}

export function reminderDue(reminder, now = new Date()) {
  if (!reminder?.lastBookUpdate) return true;
  const elapsed = now.getTime() - new Date(reminder.lastBookUpdate).getTime();
  return elapsed >= INTERVAL_MS[reminder.interval || 'monthly'];
}

export function reportRow(diary, month, todayMonth) {
  const totals = monthTotals(diary, month);
  const budget = diary.budgets[month] || {};
  const future = month > todayMonth;
  const hasActual = diary.entries.some((entry) => monthKey(entry.date) === month);
  return {
    month,
    future,
    income: future && !hasActual ? null : totals.income,
    expenses: future && !hasActual ? null : totals.expenses,
    balance: future && !hasActual ? null : totals.balance,
    budgetLeft: future && !hasActual ? null : totals.budgetLeft,
    plannedIncome: budget.plannedIncome ?? null,
    spendingBudget: budget.spendingBudget ?? null,
  };
}

function includesText(values, query, raw) {
  return values.some((value) => {
    const text = String(value || '');
    return text.toLowerCase().includes(query) || text.includes(raw);
  });
}

export function searchAll(diary, holidays, rawQuery) {
  const raw = String(rawQuery || '').trim();
  const query = raw.toLowerCase();
  if (!query) return { holidays: [], contacts: [], events: [], notes: [], entries: [] };
  return {
    holidays: holidays.filter((holiday) => includesText([holiday.name, holiday.sinhalaName, holiday.shortName], query, raw)),
    contacts: (diary.contacts || []).filter((contact) => includesText([contact.name, contact.phone, contact.note], query, raw)),
    events: diary.events.filter((event) => includesText([event.title, event.note], query, raw)),
    notes: diary.notes.filter((note) => includesText([note.title, note.body], query, raw)),
    entries: diary.entries.filter((entry) => includesText([entry.note], query, raw)),
  };
}

export function dayRecord(diary, holidays, date) {
  const holiday = holidays.find((item) => item.date === date) || null;
  const weekday = new Date(`${date}T00:00:00`).getDay();
  return {
    date,
    holiday,
    weekend: weekday === 0 || weekday === 6,
    entries: diary.entries.filter((entry) => entry.date === date),
    events: diary.events.filter((event) => date >= event.startDate && date <= (event.endDate || event.startDate)),
  };
}

export function monthCells(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: firstDay }, () => null);
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  return cells;
}
