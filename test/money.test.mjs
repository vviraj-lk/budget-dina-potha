import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCategory,
  addEntry,
  addEvent,
  deleteEvent,
  emptyDiary,
  eventSummary,
  monthTotals,
  reminderDue,
  reportRow,
  searchAll,
  dayRecord,
  setBudget,
} from '../src/money.mjs';
import { lockDiary, unlockDiary } from '../src/vault.mjs';

const HOLIDAYS = [
  { date: '2027-05-19', name: 'Vesak Full Moon Poya Day', shortName: 'Vesak Poya', sinhalaName: 'වෙසක්', types: ['B', 'P'] },
  { date: '2027-04-14', name: 'Sinhala & Tamil New Year Day', shortName: 'New Year Day', sinhalaName: 'අලුත් අවුරුද්ද', types: ['B', 'P', 'M'] },
];

function diaryWithSalary() {
  return addEntry(emptyDiary(), {
    id: 'salary',
    date: '2026-11-02',
    type: 'income',
    amount: 1000,
    categoryId: 'income-salary',
    note: 'November salary',
  });
}

test('month totals use income, expenses, and an optional budget', () => {
  let diary = diaryWithSalary();
  diary = addEntry(diary, {
    id: 'food',
    date: '2026-11-03',
    type: 'expense',
    amount: 250,
    categoryId: 'expense-food',
    note: 'lunch',
  });
  assert.deepEqual(monthTotals(diary, '2026-11'), { income: 1000, expenses: 250, balance: 750, budgetLeft: null });
  diary = setBudget(diary, '2026-11', 400, 1000);
  assert.equal(monthTotals(diary, '2026-11').budgetLeft, 150);
});

test('a new category is added once per type and can be used on an entry', () => {
  const added = addCategory(emptyDiary(), '  Pets ', 'expense');
  assert.equal(added.category.name, 'Pets');
  assert.equal(added.category.kind, 'expense');
  assert.throws(() => addCategory(added.diary, 'pets', 'expense'), /already an expense category called pets/);
  assert.throws(() => addCategory(added.diary, 'Food', 'expense'), /already an expense category/);
  assert.throws(() => addCategory(added.diary, '', 'expense'), /name is required/);
  assert.throws(() => addCategory(added.diary, 'Pets', 'spending'), /income or expense/);
  // The same name is allowed under the other type.
  assert.equal(addCategory(added.diary, 'Pets', 'income').category.kind, 'income');
  const diary = addEntry(added.diary, { id: 'vet', date: '2026-11-04', type: 'expense', amount: 500, categoryId: added.category.id, note: 'vet' });
  assert.equal(diary.entries[0].categoryId, added.category.id);
});

test('an event keeps planned cost and linked spending', () => {
  let diary = addEvent(emptyDiary(), {
    id: 'trip',
    title: 'Kandy trip',
    kind: 'trip',
    startDate: '2026-12-01',
    endDate: '2026-12-03',
    plannedCost: 1000,
    note: 'family',
  });
  diary = addEntry(diary, {
    id: 'bus',
    date: '2026-12-01',
    type: 'expense',
    amount: 300,
    categoryId: 'expense-transport',
    note: 'bus',
    eventId: 'trip',
  });
  assert.deepEqual(eventSummary(diary, diary.events[0]), { planned: 1000, spent: 300, left: 700 });
  diary = deleteEvent(diary, 'trip');
  assert.equal(diary.events.length, 0);
  assert.equal(diary.entries[0].eventId, '');
  assert.equal(diary.entries[0].note, 'bus');
});

test('reports show actuals for the past and the plan for the future', () => {
  let diary = diaryWithSalary();
  diary = setBudget(diary, '2026-11', 500, '');
  diary = setBudget(diary, '2027-01', 800, 1000);
  const past = reportRow(diary, '2026-11', '2026-11');
  const future = reportRow(diary, '2027-01', '2026-11');
  assert.equal(past.income, 1000);
  assert.equal(past.expenses, 0);
  assert.equal(future.income, null);
  assert.equal(future.spendingBudget, 800);
  assert.equal(future.plannedIncome, 1000);
});

test('search groups holidays, events, notes, and money entries', () => {
  let diary = addEvent(diaryWithSalary(), {
    id: 'meet',
    title: 'Tech meetup',
    kind: 'meetup',
    startDate: '2026-11-20',
    endDate: '2026-11-20',
    plannedCost: 1000,
    note: 'tickets',
  });
  diary = { ...diary, notes: [{ id: 'n1', updatedAt: '2026-11-01', title: 'Locker code', body: 'private' }] };
  const found = searchAll(diary, HOLIDAYS, 'vesak');
  assert.equal(found.holidays[0].date, '2027-05-19');
  assert.equal(searchAll(diary, HOLIDAYS, 'meetup').events[0].id, 'meet');
  assert.equal(searchAll(diary, HOLIDAYS, 'locker').notes[0].id, 'n1');
  assert.equal(searchAll(diary, HOLIDAYS, 'salary').entries[0].id, 'salary');
});

test('the calendar joins a holiday, an entry, and an event on one date', () => {
  let diary = addEvent(emptyDiary(), {
    id: 'new-year',
    title: 'New year travel',
    kind: 'trip',
    startDate: '2027-04-14',
    endDate: '2027-04-14',
    plannedCost: 1000,
    note: '',
  });
  diary = addEntry(diary, {
    id: 'gift',
    date: '2027-04-14',
    type: 'expense',
    amount: 1000,
    categoryId: 'expense-shopping',
    note: 'gifts',
    eventId: 'new-year',
  });
  const day = dayRecord(diary, HOLIDAYS, '2027-04-14');
  assert.equal(day.holiday.shortName, 'New Year Day');
  assert.equal(day.entries.length, 1);
  assert.equal(day.events.length, 1);
  assert.equal(day.holiday.amount, undefined);
});

test('a reminder is due only after its interval', () => {
  const now = new Date('2026-11-13T00:00:00.000Z');
  assert.equal(reminderDue({ interval: 'daily', lastBookUpdate: null }, now), true);
  assert.equal(reminderDue({ interval: 'daily', lastBookUpdate: '2026-11-13T00:00:00.000Z' }, now), false);
  assert.equal(reminderDue({ interval: 'daily', lastBookUpdate: '2026-11-11T00:00:00.000Z' }, now), true);
});

test('a password locks the diary and the wrong password does not change it', async () => {
  const diary = diaryWithSalary();
  const locked = await lockDiary(diary, 'correct-password');
  assert.equal(locked.mode, 'locked');
  assert.equal(typeof locked.salt, 'string');
  assert.equal(typeof locked.iv, 'string');
  assert.equal(typeof locked.ciphertext, 'string');
  assert.equal(JSON.stringify(locked).includes('November salary'), false);
  assert.equal(JSON.stringify(locked).includes('correct-password'), false);
  const opened = await unlockDiary(locked, 'correct-password');
  assert.equal(opened.entries[0].note, 'November salary');
  const saved = JSON.stringify(locked);
  await assert.rejects(() => unlockDiary(locked, 'wrong-password'), /Wrong password/);
  assert.equal(JSON.stringify(locked), saved);
});
