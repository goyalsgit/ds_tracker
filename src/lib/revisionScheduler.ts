export type RevisionInterval = {
  dayOffset: number;
  label: string;
};

export type RevisionItem = {
  stage: number;
  dueDate: Date;
  label: string;
};

export const DEFAULT_INTERVALS: RevisionInterval[] = [
  { dayOffset: 3, label: "Stage 1" },   // Short-term recall
  { dayOffset: 7, label: "Stage 2" },   // Medium-term recall
  { dayOffset: 21, label: "Stage 3" },  // Long-term retention
];

export function buildRevisionSchedule(
  solvedAt: Date,
  intervals: RevisionInterval[] = DEFAULT_INTERVALS
): RevisionItem[] {
  return intervals.map((interval, index) => {
    const dueDate = new Date(solvedAt);
    dueDate.setDate(dueDate.getDate() + interval.dayOffset);

    return {
      stage: index + 1,
      dueDate,
      label: interval.label,
    };
  });
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
