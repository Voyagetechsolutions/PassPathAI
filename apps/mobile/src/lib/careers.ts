// Client-side South African APS helpers — mirror the backend so the What-If
// simulator can recompute eligibility live as the student adjusts a mark.
export const apsPoints = (p: number): number =>
  p >= 80 ? 7 : p >= 70 ? 6 : p >= 60 ? 5 : p >= 50 ? 4 : p >= 40 ? 3 : p >= 30 ? 2 : 1;

export const computeAps = (marks: number[]): number =>
  marks
    .map(apsPoints)
    .sort((a, b) => b - a)
    .slice(0, 6)
    .reduce((s, x) => s + x, 0);

/** A friendly emoji per career, by title keyword then faculty. */
export function careerEmoji(title: string, faculty?: string | null): string {
  const t = title.toLowerCase();
  if (/(doctor|surgeon|physician|gp|paediatric|cardio|derma|anaesth|patholog|radiolog|gynae|ophthal|neuro)/.test(t)) return '🩺';
  if (/dentist|orthodont|maxillo/.test(t)) return '🦷';
  if (/pharmac/.test(t)) return '💊';
  if (/vet/.test(t)) return '🐾';
  if (/psycholog/.test(t)) return '🧠';
  if (/(audiolog|speech|physio|nurs|health)/.test(t)) return '🩹';
  if (/software|developer|devops|cloud|web|database|systems|blockchain|ai |machine/.test(t)) return '💻';
  if (/data|statistic|quant/.test(t)) return '📊';
  if (/cyber|network|security/.test(t)) return '🛡️';
  if (/engineer|architect|survey|construct|planner/.test(t)) return '⚙️';
  if (/law|attorney|advocate|counsel|legal|arbitr/.test(t)) return '⚖️';
  if (/account|audit|tax|cfo|financ|treasur|invest|bank|actuar|econom/.test(t)) return '📈';
  if (/market|brand|pr |public relations|commerce|e-commerce/.test(t)) return '📣';
  if (/design|creative|art|multimedia|ux|copywrit/.test(t)) return '🎨';
  if (/geolog|geophys|meteor|hydro|agro|soil|biotech|environ/.test(t)) return '🔬';
  if (/teacher|educat/.test(t)) return '📚';
  const f = (faculty ?? '').toLowerCase();
  if (f.includes('health')) return '🩺';
  if (f.includes('engineering')) return '⚙️';
  if (f.includes('science')) return '💻';
  if (f.includes('law')) return '⚖️';
  if (f.includes('commerce')) return '📈';
  if (f.includes('arts')) return '🎨';
  return '🎯';
}

interface Facts { salary: string; demand: string; outlook: string }

// Typical South African ranges by faculty — guidance, not a quote.
const FACULTY_FACTS: Record<string, Facts> = {
  'Commerce, Finance & Management Sciences': { salary: 'R250k – R900k+', demand: 'High', outlook: 'Growing' },
  'Engineering & the Built Environment': { salary: 'R300k – R1.2M', demand: 'Very High', outlook: 'Growing' },
  'Science & Information Technology': { salary: 'R350k – R1.2M', demand: 'Very High', outlook: 'Growing fast' },
  'Health Sciences & Medicine': { salary: 'R400k – R1.5M+', demand: 'Very High', outlook: 'Stable' },
  'Law & Humanities': { salary: 'R250k – R1M', demand: 'Moderate', outlook: 'Stable' },
  'Arts, Design & Marketing Sciences': { salary: 'R180k – R700k', demand: 'Moderate', outlook: 'Growing' },
};

export function factsFor(faculty?: string | null): Facts {
  return (faculty && FACULTY_FACTS[faculty]) || { salary: 'R200k – R800k', demand: 'Moderate', outlook: 'Stable' };
}
