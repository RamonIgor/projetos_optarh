
import {
  isToday,
  isThisWeek,
  isThisMonth,
  isThisQuarter,
  isThisYear,
  addDays,
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  isPast,
} from 'date-fns';
import type { Activity } from '@/types/activity';
import type { Timestamp } from 'firebase/firestore';

export type Recurrence = 'Diária' | 'Semanal' | 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual' | 'Sob demanda';

/**
 * Checks if an activity is pending based on its last execution date and recurrence.
 * An activity is pending if it has never been executed or if its last execution
 * is outside the current period for its recurrence.
 * @param activity The activity to check.
 * @returns True if the activity is pending, false otherwise.
 */
export function isActivityPending(activity: Activity): boolean {
  if (activity.recorrencia === 'Sob demanda') {
    // On-demand tasks are always pending until they are manually marked as completed for the current instance.
    return activity.ultimaExecucao === null;
  }
  
  if (!activity.ultimaExecucao) {
    return true; // Never executed, so it's pending.
  }

  const lastExecutionDate = (activity.ultimaExecucao as Timestamp).toDate();

  switch (activity.recorrencia) {
    case 'Diária':
      return !isToday(lastExecutionDate);
    case 'Semanal':
      return !isThisWeek(lastExecutionDate, { weekStartsOn: 1 }); // Monday start
    case 'Mensal':
      return !isThisMonth(lastExecutionDate);
    case 'Trimestral':
      return !isThisQuarter(lastExecutionDate);
    case 'Semestral':
       // A 'semestral' task is not pending if the last execution was in the current semester.
       // Semester 1: Month 0-5 (Jan-Jun), Semester 2: Month 6-11 (Jul-Dec)
       const currentMonth = new Date().getMonth();
       const lastExecutionMonth = lastExecutionDate.getMonth();
       const currentSemester = Math.floor(currentMonth / 6);
       const lastExecutionSemester = Math.floor(lastExecutionMonth / 6);
       const sameYear = isThisYear(lastExecutionDate);
       return !(sameYear && currentSemester === lastExecutionSemester);
    case 'Anual':
      return !isThisYear(lastExecutionDate);
    default:
      return true; // Should not happen with valid data
  }
}

/**
 * Checks if a pending activity is overdue.
 * An activity is overdue if its expected execution date (based on creation) is in the past.
 * For "Sob demanda", it's overdue if it has a `prazo` and that date is in the past.
 * @param activity The activity to check.
 * @returns True if the activity is overdue, false otherwise.
 */
export function isActivityOverdue(activity: Activity): boolean {
  if (!isActivityPending(activity)) {
    return false;
  }
  
  if (activity.recorrencia === 'Sob demanda') {
    if (activity.prazo) {
      const prazoDate = (activity.prazo as Timestamp).toDate();
      // It's overdue if the deadline is in the past AND it hasn't been completed yet.
      // isActivityPending already checks for `ultimaExecucao === null`.
      return isPast(prazoDate);
    }
    return false; // No deadline, so it can't be overdue.
  }
  
  const referenceDate = activity.ultimaExecucao 
    ? (activity.ultimaExecucao as Timestamp).toDate()
    : (activity.createdAt as Timestamp).toDate();

  const nextExecution = getNextExecutionDate(referenceDate, activity.recorrencia);

  return new Date() > nextExecution;
}

/**
 * Calculates the next expected execution date for an activity.
 * @param activity The activity object.
 * @returns The next execution Date, or null for on-demand tasks.
 */
export function getNextExecution(activity: Activity): Date | null {
  // For 'Sob demanda', the deadline is the `prazo` field itself.
  if (activity.recorrencia === 'Sob demanda') {
    return activity.prazo ? (activity.prazo as Timestamp).toDate() : null;
  }

  const referenceDate = activity.ultimaExecucao 
    ? (activity.ultimaExecucao as Timestamp).toDate()
    : (activity.createdAt as Timestamp).toDate();
    
  return getNextExecutionDate(referenceDate, activity.recorrencia);
}

function getNextExecutionDate(referenceDate: Date, recurrence: Recurrence | null): Date {
   switch (recurrence) {
        case 'Diária':
            return addDays(startOfDay(referenceDate), 1);
        case 'Semanal':
            return addWeeks(startOfWeek(referenceDate, { weekStartsOn: 1 }), 1);
        case 'Mensal':
            return addMonths(startOfMonth(referenceDate), 1);
        case 'Trimestral':
            return addQuarters(startOfQuarter(referenceDate), 1);
        case 'Semestral':
            const startOfNextSemester = addMonths(startOfMonth(referenceDate), 6);
            return startOfNextSemester;
        case 'Anual':
            return addYears(startOfYear(referenceDate), 1);
        default:
            // For 'Sob demanda' or null, we can return a distant future date or handle it
            // but for overdue logic, returning the reference is safe.
            return referenceDate;
    }
}
