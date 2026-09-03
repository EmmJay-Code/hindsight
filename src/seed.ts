import type { Prediction } from './types.ts';

/**
 * Sample data so first-time users (and reviewers) instantly see
 * what a calibrated — and miscalibrated — journal looks like.
 * Dates are generated relative to "now" so the demo never looks stale.
 */

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function datePlus(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface SeedDef {
  title: string;
  details: string;
  rationale: string;
  disconfirm: string;
  category: Prediction['category'];
  confidence: number;
  status: Prediction['status'];
  createdDaysAgo: number;
  resolvedDaysAgo: number | null;
  dueInDays: number | null;
  note: string;
  tags: string[];
}

const DEFS: SeedDef[] = [
  {
    title: 'We will ship the onboarding redesign before end of quarter',
    details: 'New 3-step signup flow, currently in QA. Two open P1 bugs.',
    rationale: 'QA pass rate is 92% and both P1s have owners. Past 3 releases slipped by ~1 week, but we padded this one.',
    disconfirm: 'If either P1 is still open 5 days before quarter-end, I am wrong.',
    category: 'Work', confidence: 75, status: 'correct',
    createdDaysAgo: 90, resolvedDaysAgo: 12, dueInDays: null,
    note: 'Shipped with 4 days to spare. Padding worked.',
    tags: ['shipping', 'team'],
  },
  {
    title: 'Bitcoin will close above $100k this month',
    details: 'Price-chasing prediction to test my crypto overconfidence.',
    rationale: 'Honestly: vibes and headlines. This is exactly the kind of prediction I should stop making.',
    disconfirm: 'Price action — the close decides.',
    category: 'Money', confidence: 85, status: 'incorrect',
    createdDaysAgo: 75, resolvedDaysAgo: 45, dueInDays: null,
    note: 'Closed well below. 85% on vibes was embarrassing — the lesson.',
    tags: ['crypto'],
  },
  {
    title: 'I will run 3x per week for a full month',
    details: 'Habit prediction. Run = 20+ min.',
    rationale: 'Calendar-blocked Tue/Thu/Sun and told a friend. Implementation intentions roughly double follow-through.',
    disconfirm: 'Miss more than 2 sessions in any week.',
    category: 'Health', confidence: 70, status: 'correct',
    createdDaysAgo: 60, resolvedDaysAgo: 28, dueInDays: null,
    note: 'Missed exactly 2 sessions. Accountability text thread saved it.',
    tags: ['habits'],
  },
  {
    title: 'Our biggest customer will renew at the higher tier',
    details: 'Renewal conversation next week; champion is supportive but procurement is slow.',
    rationale: 'Champion said yes; procurement stalls 40% of these. 65% feels honest.',
    disconfirm: 'If procurement adds new security review, downgrade to 40%.',
    category: 'Work', confidence: 65, status: 'correct',
    createdDaysAgo: 52, resolvedDaysAgo: 20, dueInDays: null,
    note: 'Renewed after a 2-week delay. The stall happened but did not kill it.',
    tags: ['sales'],
  },
  {
    title: 'AI agent hype will cool — our team will deprioritize the bot project',
    details: 'Meta-prediction about our own roadmap.',
    rationale: 'Two failed pilots and no owner. Teams cut ownerless projects ~80% of the time.',
    disconfirm: 'If a VP sponsors it, all bets off.',
    category: 'Tech', confidence: 80, status: 'correct',
    createdDaysAgo: 48, resolvedDaysAgo: 15, dueInDays: null,
    note: 'Deprioritized in planning. Called it.',
    tags: ['roadmap'],
  },
  {
    title: 'I will finish the novel draft by summer',
    details: '60k words, currently at 18k.',
    rationale: 'Writing 500 words/day is realistic but I have never sustained it. 55% is generous.',
    disconfirm: 'If I fall 2 weeks behind pace, revise down.',
    category: 'Personal', confidence: 55, status: 'incorrect',
    createdDaysAgo: 120, resolvedDaysAgo: 30, dueInDays: null,
    note: 'Stalled at 31k. Pace assumption was fantasy — track weekly next time.',
    tags: ['writing'],
  },
  {
    title: 'The neighbor’s fence dispute will resolve without lawyers',
    details: 'Survey ordered; both sides talking.',
    rationale: 'Most such disputes settle once the survey exists. Base rate ~70%.',
    disconfirm: 'Certified letter from their attorney.',
    category: 'Relationships', confidence: 70, status: 'correct',
    createdDaysAgo: 40, resolvedDaysAgo: 9, dueInDays: null,
    note: 'Survey settled it in one conversation.',
    tags: ['neighbors'],
  },
  {
    title: 'Side-project landing page will convert above 5%',
    details: 'Waitlist page, traffic from one launch post.',
    rationale: 'My last three pages converted 2–4%. 90% confidence here is pure hope — included as an overconfidence exhibit.',
    disconfirm: 'Analytics after 500 visitors.',
    category: 'Work', confidence: 90, status: 'incorrect',
    createdDaysAgo: 35, resolvedDaysAgo: 7, dueInDays: null,
    note: 'Converted at 3.1%. Exhibit A for the calibration chart.',
    tags: ['marketing'],
  },
  {
    title: 'We will host Thanksgiving this year',
    details: 'Family logistics prediction.',
    rationale: 'Sister hinted twice; our place fits everyone. 60/40.',
    disconfirm: 'If sister renovates the kitchen in time, she will want to host.',
    category: 'Relationships', confidence: 60, status: 'pending',
    createdDaysAgo: 6, resolvedDaysAgo: null, dueInDays: 80,
    note: '', tags: ['family'],
  },
  {
    title: 'I will stick to the $400/mo dining budget in October',
    details: 'Tracking in the budget app daily.',
    rationale: 'Hit it 2 of last 4 months. 50% is the honest number.',
    disconfirm: 'Two restaurant weeks in a row = doomed.',
    category: 'Money', confidence: 50, status: 'pending',
    createdDaysAgo: 3, resolvedDaysAgo: null, dueInDays: 28,
    note: '', tags: ['budget'],
  },
  {
    title: 'Team will adopt the new RFC process without a revolt',
    details: 'Lightweight template, trial for one quarter.',
    rationale: 'Two vocal skeptics but the template genuinely saves time. 68%.',
    disconfirm: 'If the skeptics skip the trial retro, it is dead.',
    category: 'Work', confidence: 68, status: 'pending',
    createdDaysAgo: 2, resolvedDaysAgo: null, dueInDays: 21,
    note: '', tags: ['process'],
  },
  {
    title: 'Marathon under 4 hours in spring',
    details: 'Current long run: 14 miles. 16 weeks out.',
    rationale: 'Plan says possible; my history says I get injured at mile 18 of training. 45% and proud of the humility.',
    disconfirm: 'Any missed long run > 2 weeks = revise.',
    category: 'Health', confidence: 45, status: 'pending',
    createdDaysAgo: 1, resolvedDaysAgo: null, dueInDays: 110,
    note: '', tags: ['running'],
  },
];

export function buildSeed(): Prediction[] {
  return DEFS.map((d, i) => ({
    id: `seed-${String(i + 1).padStart(2, '0')}`,
    title: d.title,
    details: d.details,
    rationale: d.rationale,
    disconfirm: d.disconfirm,
    category: d.category,
    confidence: d.confidence,
    status: d.status,
    createdAt: daysAgo(d.createdDaysAgo),
    resolveBy: d.dueInDays === null ? null : datePlus(d.dueInDays),
    resolvedAt: d.resolvedDaysAgo === null ? null : daysAgo(d.resolvedDaysAgo),
    resolutionNote: d.note,
    tags: d.tags,
  }));
}
