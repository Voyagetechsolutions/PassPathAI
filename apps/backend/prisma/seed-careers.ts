import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds a South African career database driven by the 26 public universities and
 * ~100 high-demand careers across six faculties. Each career stores the school
 * subjects it needs and a programme per offering university with an approximate
 * APS cut-off. Idempotent: upserts by title, recreating requirements + programmes.
 *
 *   npm run db:seed:careers
 *
 * NOTE: APS cut-offs are realistic approximations for guidance — they change yearly
 * and vary by university. Always confirm on the university's official prospectus.
 */

// ─── The 26 public universities ────────────────────────────────────────────────
const U: Record<string, string> = {
  NWU: 'North-West University',
  RU: 'Rhodes University',
  SMU: 'Sefako Makgatho Health Sciences University',
  SPU: 'Sol Plaatje University',
  SU: 'Stellenbosch University',
  UCT: 'University of Cape Town',
  UFH: 'University of Fort Hare',
  UKZN: 'University of KwaZulu-Natal',
  UL: 'University of Limpopo',
  UMP: 'University of Mpumalanga',
  UP: 'University of Pretoria',
  NMU: 'Nelson Mandela University',
  UJ: 'University of Johannesburg',
  UNISA: 'University of South Africa',
  UNIVEN: 'University of Venda',
  UFS: 'University of the Free State',
  UWC: 'University of the Western Cape',
  WITS: 'University of the Witwatersrand',
  UNIZULU: 'University of Zululand',
  WSU: 'Walter Sisulu University',
  CPUT: 'Cape Peninsula University of Technology',
  CUT: 'Central University of Technology',
  DUT: 'Durban University of Technology',
  MUT: 'Mangosuthu University of Technology',
  TUT: 'Tshwane University of Technology',
  VUT: 'Vaal University of Technology',
};

// Higher-demand universities carry higher APS cut-offs; universities of technology
// (diplomas) sit lower. Adjustment applied per programme on top of the career base.
const TIER: Record<string, number> = {};
['UCT', 'WITS', 'SU', 'UP', 'UKZN'].forEach((k) => (TIER[k] = 3));
['UFH', 'UL', 'UNIVEN', 'UNIZULU', 'WSU', 'UMP', 'SPU', 'SMU', 'UNISA'].forEach((k) => (TIER[k] = -3));
['CPUT', 'CUT', 'DUT', 'MUT', 'TUT', 'VUT'].forEach((k) => (TIER[k] = -6));

// Which universities offer each field (most prominent first; capped to 6 / career).
const G: Record<string, string[]> = {
  COMM_TOP: ['UCT', 'WITS', 'SU', 'UP', 'UKZN', 'RU'],
  COMM: ['UP', 'UKZN', 'UJ', 'NWU', 'NMU', 'UWC'],
  ENG: ['WITS', 'UP', 'UCT', 'SU', 'UKZN', 'UJ'],
  ENG_TECH: ['TUT', 'CPUT', 'DUT', 'VUT', 'NMU', 'UJ'],
  BUILT: ['UCT', 'WITS', 'UP', 'UKZN', 'NMU', 'TUT'],
  SCI: ['UCT', 'WITS', 'UP', 'SU', 'UKZN', 'UJ'],
  SCI_BROAD: ['UP', 'UKZN', 'UJ', 'NWU', 'UFS', 'UWC'],
  SCI_AGRI: ['UP', 'SU', 'UKZN', 'UFS', 'NWU', 'UFH'],
  MED: ['UCT', 'WITS', 'UP', 'UKZN', 'SU', 'UFS'],
  VET: ['UP'],
  PHARM: ['RU', 'UWC', 'NWU', 'UKZN', 'SMU', 'TUT'],
  HEALTH: ['UCT', 'WITS', 'UP', 'UKZN', 'SU', 'UWC'],
  LAW: ['UCT', 'WITS', 'UP', 'SU', 'UKZN', 'UJ'],
  HUMAN: ['UCT', 'WITS', 'UP', 'SU', 'UJ', 'RU'],
  DESIGN: ['CPUT', 'TUT', 'DUT', 'NMU', 'UJ', 'VUT'],
};

type Sub = [string, number];
interface CareerSeed {
  title: string;
  faculty: string;
  degree: string;
  description: string;
  subjects: Sub[];
  aps: number;
  group: keyof typeof G;
}

const F1 = 'Commerce, Finance & Management Sciences';
const F2 = 'Engineering & the Built Environment';
const F3 = 'Science & Information Technology';
const F4 = 'Health Sciences & Medicine';
const F5 = 'Law & Humanities';
const F6 = 'Arts, Design & Marketing Sciences';

const M = (n: number): Sub => ['Mathematics', n];
const PS = (n: number): Sub => ['Physical Sciences', n];
const LS = (n: number): Sub => ['Life Sciences', n];
const EN = (n: number): Sub => ['English Home Language', n];
const AC = (n: number): Sub => ['Accounting', n];

const CAREERS: CareerSeed[] = [
  // ── Faculty 1: Commerce, Finance & Management Sciences ──
  { title: 'Chartered Accountant [CA(SA)]', faculty: F1, degree: 'BCom Accounting Sciences', description: 'Audit, financial reporting and advising businesses; the CA(SA) route.', subjects: [M(70), AC(60)], aps: 36, group: 'COMM_TOP' },
  { title: 'Actuary', faculty: F1, degree: 'BSc Actuarial Science', description: 'Use mathematics and statistics to price and manage financial risk.', subjects: [M(80)], aps: 42, group: 'COMM_TOP' },
  { title: 'Investment Banker', faculty: F1, degree: 'BBusSc Finance', description: 'Raise capital and advise on mergers, listings and deals.', subjects: [M(70)], aps: 40, group: 'COMM_TOP' },
  { title: 'Quantitative Analyst', faculty: F1, degree: 'BSc Financial Mathematics', description: 'Build mathematical models for trading and risk ("quant").', subjects: [M(80)], aps: 42, group: 'COMM_TOP' },
  { title: 'Financial Risk Manager', faculty: F1, degree: 'BCom Financial Risk Management', description: 'Identify and control financial risk in banks and firms.', subjects: [M(60)], aps: 34, group: 'COMM' },
  { title: 'Corporate Tax Specialist', faculty: F1, degree: 'BCom Taxation', description: 'Advise companies on tax strategy and compliance.', subjects: [M(60), AC(50)], aps: 34, group: 'COMM' },
  { title: 'Portfolio / Asset Manager', faculty: F1, degree: 'BCom Investment Management', description: 'Manage investment portfolios and grow clients’ wealth.', subjects: [M(60)], aps: 36, group: 'COMM_TOP' },
  { title: 'Management Consultant', faculty: F1, degree: 'BBusSc / BCom Honours', description: 'Solve strategy and operations problems for organisations.', subjects: [M(70)], aps: 38, group: 'COMM_TOP' },
  { title: 'Internal Audit Manager', faculty: F1, degree: 'BCom Internal Auditing', description: 'Check controls, risk and governance from inside a company.', subjects: [M(50), AC(50)], aps: 32, group: 'COMM' },
  { title: 'Treasury Manager', faculty: F1, degree: 'BCom Finance', description: 'Manage a company’s cash, funding and currency risk.', subjects: [M(60)], aps: 34, group: 'COMM' },
  { title: 'Credit Risk Manager', faculty: F1, degree: 'BCom Credit Management', description: 'Assess and manage lending risk for banks and lenders.', subjects: [M(50)], aps: 30, group: 'COMM' },
  { title: 'Financial Controller', faculty: F1, degree: 'BCom Financial Accounting', description: 'Run a company’s accounting, reporting and budgets.', subjects: [M(60), AC(50)], aps: 34, group: 'COMM' },
  { title: 'Stockbroker', faculty: F1, degree: 'BCom Finance', description: 'Trade shares and advise clients on the markets.', subjects: [M(60)], aps: 34, group: 'COMM' },
  { title: 'Forensic Accountant', faculty: F1, degree: 'BCom Forensic Accounting', description: 'Investigate fraud and financial crime.', subjects: [M(60), AC(60)], aps: 36, group: 'COMM' },
  { title: 'Supply Chain Director', faculty: F1, degree: 'BCom Logistics & Supply Chain', description: 'Run the flow of goods from supplier to customer.', subjects: [M(50)], aps: 32, group: 'COMM' },
  { title: 'Procurement Manager', faculty: F1, degree: 'BCom Logistics Management', description: 'Source and buy goods and services efficiently.', subjects: [M(50)], aps: 30, group: 'COMM' },
  { title: 'Economist', faculty: F1, degree: 'BCom Economics', description: 'Analyse markets, policy and economic trends.', subjects: [M(60), ['Economics', 60]], aps: 36, group: 'COMM' },
  { title: 'Human Resources Director', faculty: F1, degree: 'BCom Human Resource Management', description: 'Lead people strategy, hiring and culture.', subjects: [EN(50)], aps: 30, group: 'COMM' },
  { title: 'Business Analyst', faculty: F1, degree: 'BCom Business Informatics', description: 'Bridge business needs and technology solutions.', subjects: [M(60)], aps: 34, group: 'COMM' },
  { title: 'Industrial Psychologist', faculty: F1, degree: 'BCom Industrial Psychology', description: 'Apply psychology to the workplace and performance.', subjects: [M(50)], aps: 34, group: 'COMM' },

  // ── Faculty 2: Engineering & the Built Environment ──
  { title: 'Civil Engineer', faculty: F2, degree: 'BEng Civil Engineering', description: 'Design roads, bridges, dams and water systems.', subjects: [M(70), PS(70)], aps: 38, group: 'ENG' },
  { title: 'Structural Engineer', faculty: F2, degree: 'BEng Civil (Structural)', description: 'Design the structures that keep buildings standing.', subjects: [M(70), PS(70)], aps: 38, group: 'ENG' },
  { title: 'Mining Engineer', faculty: F2, degree: 'BEng Mining Engineering', description: 'Plan and run safe, productive mines.', subjects: [M(70), PS(70)], aps: 38, group: 'ENG' },
  { title: 'Electrical Engineer', faculty: F2, degree: 'BEng Electrical Engineering', description: 'Design power, electronics and control systems.', subjects: [M(70), PS(70)], aps: 38, group: 'ENG' },
  { title: 'Mechanical Engineer', faculty: F2, degree: 'BEng Mechanical Engineering', description: 'Design machines, engines and manufacturing systems.', subjects: [M(70), PS(70)], aps: 38, group: 'ENG' },
  { title: 'Chemical Engineer', faculty: F2, degree: 'BEng Chemical Engineering', description: 'Turn raw materials into fuels, food and products at scale.', subjects: [M(70), PS(70)], aps: 38, group: 'ENG' },
  { title: 'Industrial Engineer', faculty: F2, degree: 'BEng Industrial Engineering', description: 'Make systems and processes more efficient.', subjects: [M(70), PS(60)], aps: 36, group: 'ENG' },
  { title: 'Renewable Energy Engineer', faculty: F2, degree: 'BEng (Energy specialisation)', description: 'Design solar, wind and clean-energy systems.', subjects: [M(70), PS(70)], aps: 38, group: 'ENG' },
  { title: 'Mechatronics Engineer', faculty: F2, degree: 'BEng Mechatronics', description: 'Combine mechanical, electronic and software for robots.', subjects: [M(70), PS(70)], aps: 38, group: 'ENG' },
  { title: 'Aeronautical Engineer', faculty: F2, degree: 'BEng Aeronautical Engineering', description: 'Design aircraft and flight systems.', subjects: [M(70), PS(70)], aps: 40, group: 'ENG' },
  { title: 'Metallurgical Engineer', faculty: F2, degree: 'BEng Metallurgical Engineering', description: 'Extract and engineer metals and materials.', subjects: [M(70), PS(70)], aps: 36, group: 'ENG' },
  { title: 'Geotechnical Engineer', faculty: F2, degree: 'BEng Civil (Geotechnical)', description: 'Engineer foundations and the ground structures sit on.', subjects: [M(70), PS(70)], aps: 38, group: 'ENG' },
  { title: 'Petroleum Engineer', faculty: F2, degree: 'BEng Chemical / Petroleum', description: 'Extract and process oil and gas.', subjects: [M(70), PS(70)], aps: 38, group: 'ENG' },
  { title: 'Quantity Surveyor', faculty: F2, degree: 'BSc Quantity Surveying', description: 'Manage construction budgets and contracts.', subjects: [M(60), PS(50)], aps: 34, group: 'BUILT' },
  { title: 'Construction Manager', faculty: F2, degree: 'BSc Construction Management', description: 'Run building projects on time and on budget.', subjects: [M(50)], aps: 32, group: 'BUILT' },
  { title: 'Town & Regional Planner', faculty: F2, degree: 'B Urban & Regional Planning', description: 'Plan how towns and cities grow and are used.', subjects: [M(50), ['Geography', 50]], aps: 32, group: 'BUILT' },
  { title: 'Architect', faculty: F2, degree: 'BAS Architecture', description: 'Design buildings and the spaces people live in.', subjects: [M(60), PS(50)], aps: 36, group: 'BUILT' },
  { title: 'Land Surveyor', faculty: F2, degree: 'BSc Geomatics', description: 'Measure and map land for development.', subjects: [M(60), PS(50)], aps: 34, group: 'BUILT' },
  { title: 'Environmental Engineer', faculty: F2, degree: 'BEng Environmental / Civil', description: 'Engineer clean water, waste and pollution solutions.', subjects: [M(70), PS(60)], aps: 36, group: 'ENG' },
  { title: 'Project Manager (Engineering)', faculty: F2, degree: 'BEng + Project Management', description: 'Lead complex engineering and construction projects.', subjects: [M(60), PS(60)], aps: 34, group: 'ENG_TECH' },

  // ── Faculty 3: Science & Information Technology ──
  { title: 'Enterprise Cloud Architect', faculty: F3, degree: 'BSc Computer Science', description: 'Design large-scale cloud systems for businesses.', subjects: [M(60)], aps: 34, group: 'SCI' },
  { title: 'AI / Machine Learning Engineer', faculty: F3, degree: 'BSc Computer Science (AI)', description: 'Build systems that learn from data.', subjects: [M(70)], aps: 38, group: 'SCI' },
  { title: 'Data Scientist', faculty: F3, degree: 'BSc Data Science', description: 'Find insights in data using statistics and code.', subjects: [M(70)], aps: 38, group: 'SCI' },
  { title: 'Senior Software Developer', faculty: F3, degree: 'BSc Computer Science', description: 'Build apps, websites and software systems.', subjects: [M(60)], aps: 34, group: 'SCI' },
  { title: 'Cybersecurity Analyst', faculty: F3, degree: 'BSc IT (Information Security)', description: 'Protect systems and data from attack.', subjects: [M(60)], aps: 32, group: 'SCI_BROAD' },
  { title: 'DevOps Engineer', faculty: F3, degree: 'BSc Computer Science', description: 'Automate how software is built and deployed.', subjects: [M(60)], aps: 32, group: 'SCI_BROAD' },
  { title: 'Full-Stack Web Developer', faculty: F3, degree: 'BSc Information Technology', description: 'Build the front and back of web applications.', subjects: [M(50)], aps: 30, group: 'SCI_BROAD' },
  { title: 'Business Intelligence Developer', faculty: F3, degree: 'BSc Information Systems', description: 'Turn company data into dashboards and decisions.', subjects: [M(60)], aps: 32, group: 'SCI_BROAD' },
  { title: 'Database Administrator', faculty: F3, degree: 'BSc Computer Science / IT', description: 'Keep critical databases fast, safe and available.', subjects: [M(50)], aps: 30, group: 'SCI_BROAD' },
  { title: 'Network Infrastructure Engineer', faculty: F3, degree: 'BSc Computer Engineering / IT', description: 'Design and run computer networks.', subjects: [M(60)], aps: 32, group: 'SCI_BROAD' },
  { title: 'Solutions Architect', faculty: F3, degree: 'BSc Computer Science', description: 'Design how software systems fit together.', subjects: [M(60)], aps: 34, group: 'SCI' },
  { title: 'Blockchain Developer', faculty: F3, degree: 'BSc Computer Science', description: 'Build decentralised apps and smart contracts.', subjects: [M(70)], aps: 36, group: 'SCI' },
  { title: 'Systems Analyst', faculty: F3, degree: 'BSc Information Systems', description: 'Analyse and improve business IT systems.', subjects: [M(50)], aps: 30, group: 'SCI_BROAD' },
  { title: 'Exploration Geologist', faculty: F3, degree: 'BSc Geology', description: 'Find mineral and energy resources in the earth.', subjects: [M(60), PS(60), ['Geography', 50]], aps: 34, group: 'SCI' },
  { title: 'Geophysicist', faculty: F3, degree: 'BSc Geophysics', description: 'Study the earth’s physics to find resources.', subjects: [M(70), PS(60)], aps: 36, group: 'SCI' },
  { title: 'Agronomist / Soil Scientist', faculty: F3, degree: 'BSc Agriculture (Soil Science)', description: 'Improve crops, soil and food production.', subjects: [M(50), LS(50)], aps: 30, group: 'SCI_AGRI' },
  { title: 'Biotechnologist', faculty: F3, degree: 'BSc Biotechnology', description: 'Use living systems to make medicines and products.', subjects: [M(60), LS(60), PS(50)], aps: 34, group: 'SCI_BROAD' },
  { title: 'Statistician / Data Analyst', faculty: F3, degree: 'BSc Mathematical Statistics', description: 'Use statistics to answer real-world questions.', subjects: [M(70)], aps: 36, group: 'SCI' },
  { title: 'Meteorologist', faculty: F3, degree: 'BSc Meteorology', description: 'Forecast weather and study the atmosphere.', subjects: [M(60), PS(60)], aps: 34, group: 'SCI_BROAD' },
  { title: 'Hydrologist', faculty: F3, degree: 'BSc Hydrology', description: 'Study and manage water resources.', subjects: [M(50), ['Geography', 50]], aps: 30, group: 'SCI_AGRI' },

  // ── Faculty 4: Health Sciences & Medicine ──
  { title: 'Neurosurgeon', faculty: F4, degree: 'MBChB (then specialise)', description: 'Operate on the brain and nervous system.', subjects: [PS(70), LS(70), M(70)], aps: 42, group: 'MED' },
  { title: 'Cardiologist', faculty: F4, degree: 'MBChB (then specialise)', description: 'Diagnose and treat heart conditions.', subjects: [PS(70), LS(70), M(70)], aps: 42, group: 'MED' },
  { title: 'Anaesthesiologist', faculty: F4, degree: 'MBChB (then specialise)', description: 'Keep patients safe and pain-free in surgery.', subjects: [PS(70), LS(70), M(70)], aps: 42, group: 'MED' },
  { title: 'Orthopaedic Surgeon', faculty: F4, degree: 'MBChB (then specialise)', description: 'Operate on bones, joints and muscles.', subjects: [PS(70), LS(70), M(70)], aps: 42, group: 'MED' },
  { title: 'Gynaecologist / Obstetrician', faculty: F4, degree: 'MBChB (then specialise)', description: 'Care for women’s health and childbirth.', subjects: [PS(70), LS(70), M(70)], aps: 42, group: 'MED' },
  { title: 'Pathologist', faculty: F4, degree: 'MBChB (then specialise)', description: 'Diagnose disease in the laboratory.', subjects: [PS(70), LS(70), M(70)], aps: 42, group: 'MED' },
  { title: 'Radiologist', faculty: F4, degree: 'MBChB (then specialise)', description: 'Read scans and X-rays to diagnose patients.', subjects: [PS(70), LS(70), M(70)], aps: 42, group: 'MED' },
  { title: 'Paediatrician', faculty: F4, degree: 'MBChB (then specialise)', description: 'Care for the health of children.', subjects: [PS(70), LS(70), M(70)], aps: 42, group: 'MED' },
  { title: 'Ophthalmologist', faculty: F4, degree: 'MBChB (then specialise)', description: 'Diagnose and treat eye conditions.', subjects: [PS(70), LS(70), M(70)], aps: 42, group: 'MED' },
  { title: 'Dermatologist', faculty: F4, degree: 'MBChB (then specialise)', description: 'Treat skin, hair and nail conditions.', subjects: [PS(70), LS(70), M(70)], aps: 42, group: 'MED' },
  { title: 'General Practitioner (GP)', faculty: F4, degree: 'MBChB', description: 'Diagnose and treat patients as a family doctor.', subjects: [PS(70), LS(70), M(60)], aps: 40, group: 'MED' },
  { title: 'Dentist', faculty: F4, degree: 'BChD / BDS Dentistry', description: 'Care for teeth and oral health.', subjects: [PS(70), LS(60), M(60)], aps: 40, group: 'MED' },
  { title: 'Orthodontist', faculty: F4, degree: 'BChD then MDent', description: 'Straighten teeth and correct the bite.', subjects: [PS(70), LS(60), M(60)], aps: 40, group: 'MED' },
  { title: 'Maxillofacial Surgeon', faculty: F4, degree: 'MBChB / BDS + specialise', description: 'Operate on the face, jaw and mouth.', subjects: [PS(70), LS(70), M(60)], aps: 42, group: 'MED' },
  { title: 'Clinical Pharmacist', faculty: F4, degree: 'BPharm', description: 'Dispense medicine and advise on safe use.', subjects: [PS(60), LS(60), M(60)], aps: 36, group: 'PHARM' },
  { title: 'Veterinarian', faculty: F4, degree: 'BVSc (UP – Onderstepoort)', description: 'Treat and care for animals.', subjects: [PS(70), LS(70), M(70)], aps: 42, group: 'VET' },
  { title: 'Clinical Psychologist', faculty: F4, degree: 'BA/BSc Psychology (then Masters)', description: 'Help people with mental health and behaviour.', subjects: [LS(50)], aps: 34, group: 'HEALTH' },
  { title: 'Medical Physicist', faculty: F4, degree: 'BSc Medical Physics', description: 'Apply physics to medicine, like radiation therapy.', subjects: [M(70), PS(70)], aps: 38, group: 'SCI' },
  { title: 'Audiologist', faculty: F4, degree: 'B Audiology', description: 'Diagnose and treat hearing and balance problems.', subjects: [LS(60), M(50)], aps: 34, group: 'HEALTH' },
  { title: 'Speech-Language Therapist', faculty: F4, degree: 'B Speech-Language Pathology', description: 'Help people with speech, language and swallowing.', subjects: [LS(60), EN(60)], aps: 34, group: 'HEALTH' },

  // ── Faculty 5: Law & Humanities ──
  { title: 'Commercial / Corporate Attorney', faculty: F5, degree: 'LLB', description: 'Handle company deals, contracts and mergers.', subjects: [EN(60)], aps: 36, group: 'LAW' },
  { title: 'Advocate', faculty: F5, degree: 'LLB (then Bar)', description: 'Represent clients in the High Court.', subjects: [EN(60)], aps: 36, group: 'LAW' },
  { title: 'Corporate General Counsel', faculty: F5, degree: 'LLB', description: 'Lead a company’s in-house legal team.', subjects: [EN(60)], aps: 36, group: 'LAW' },
  { title: 'Patent / IP Attorney', faculty: F5, degree: 'BSc/BEng + LLB', description: 'Protect inventions and intellectual property.', subjects: [M(60), EN(60)], aps: 38, group: 'LAW' },
  { title: 'Maritime Lawyer', faculty: F5, degree: 'LLB + LLM (Shipping)', description: 'Handle shipping, ports and sea-trade law.', subjects: [EN(60)], aps: 36, group: 'LAW' },
  { title: 'Labour Lawyer', faculty: F5, degree: 'LLB (Labour Law)', description: 'Handle workplace disputes and employment law.', subjects: [EN(60)], aps: 34, group: 'LAW' },
  { title: 'Company Secretary', faculty: F5, degree: 'LLB / BCom Law', description: 'Keep companies legally compliant and well-governed.', subjects: [EN(50)], aps: 32, group: 'LAW' },
  { title: 'Arbitrator / Mediator', faculty: F5, degree: 'LLB + dispute resolution', description: 'Resolve disputes outside of court.', subjects: [EN(60)], aps: 34, group: 'LAW' },
  { title: 'Media & Entertainment Lawyer', faculty: F5, degree: 'LLB (Media Law)', description: 'Handle copyright, media and creative-industry law.', subjects: [EN(60)], aps: 34, group: 'LAW' },
  { title: 'Environmental Lawyer', faculty: F5, degree: 'LLB + LLM (Environmental)', description: 'Use law to protect the environment.', subjects: [EN(60)], aps: 34, group: 'LAW' },

  // ── Faculty 6: Arts, Design & Marketing Sciences ──
  { title: 'E-Commerce Director', faculty: F6, degree: 'BCom Marketing / BA Digital Design', description: 'Lead online stores and digital sales.', subjects: [EN(50)], aps: 30, group: 'COMM' },
  { title: 'Digital Marketing Director', faculty: F6, degree: 'BCom / BA Strategic Brand Management', description: 'Lead digital campaigns and brand strategy.', subjects: [EN(50)], aps: 30, group: 'COMM' },
  { title: 'Creative Director', faculty: F6, degree: 'BA Graphic Design / Fine Arts', description: 'Lead the creative vision for brands and campaigns.', subjects: [['Visual Arts', 50]], aps: 28, group: 'DESIGN' },
  { title: 'UX Director', faculty: F6, degree: 'BA/BSc Human-Computer Interaction', description: 'Design how people experience apps and products.', subjects: [M(50)], aps: 32, group: 'DESIGN' },
  { title: 'Brand Manager', faculty: F6, degree: 'BCom Marketing Management', description: 'Build and grow a brand in the market.', subjects: [EN(50)], aps: 30, group: 'COMM' },
  { title: 'Public Relations Director', faculty: F6, degree: 'BA Corporate Communication', description: 'Manage reputation and public image.', subjects: [EN(60)], aps: 30, group: 'HUMAN' },
  { title: 'Art Director', faculty: F6, degree: 'BA Visual Communication', description: 'Lead the look and feel of visual work.', subjects: [['Visual Arts', 50]], aps: 28, group: 'DESIGN' },
  { title: 'Multimedia Producer', faculty: F6, degree: 'BA Multimedia / Digital Media', description: 'Produce video, audio and interactive media.', subjects: [['Visual Arts', 50]], aps: 28, group: 'DESIGN' },
  { title: 'Copywriting Director', faculty: F6, degree: 'BA Creative Writing / Communications', description: 'Lead the words behind advertising and brands.', subjects: [EN(60)], aps: 30, group: 'HUMAN' },
  { title: 'Industrial Product Designer', faculty: F6, degree: 'B Industrial Design', description: 'Design physical products people use every day.', subjects: [M(50), ['Visual Arts', 50]], aps: 30, group: 'DESIGN' },
];

function clampAps(n: number): number {
  return Math.max(18, Math.min(48, n));
}

function buildProgrammes(c: CareerSeed): Array<{ university: string; programmeName: string; minAps: number }> {
  return G[c.group].slice(0, 6).map((abbr) => ({
    university: U[abbr],
    programmeName: c.degree,
    minAps: clampAps(c.aps + (TIER[abbr] ?? 0)),
  }));
}

/** Neon serverless auto-suspends; the first query on a cold endpoint can fail.
 *  Retry a trivial query until the database wakes before seeding. */
async function waitForDb(): Promise<void> {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch {
      // eslint-disable-next-line no-console
      console.log(`  waking database… (${attempt}/12)`);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  throw new Error('Database did not become reachable in time.');
}

async function main(): Promise<void> {
  await waitForDb();
  let count = 0;
  for (const c of CAREERS) {
    const career = await prisma.career.upsert({
      where: { title: c.title },
      update: { description: c.description, faculty: c.faculty },
      create: { title: c.title, description: c.description, faculty: c.faculty },
    });

    await prisma.careerSubjectRequirement.deleteMany({ where: { careerId: career.id } });
    await prisma.careerSubjectRequirement.createMany({
      data: c.subjects.map(([subjectName, minPercent]) => ({ careerId: career.id, subjectName, minPercent })),
    });

    await prisma.universityProgramme.deleteMany({ where: { careerId: career.id } });
    await prisma.universityProgramme.createMany({
      data: buildProgrammes(c).map((p) => ({ careerId: career.id, university: p.university, programmeName: p.programmeName, minAps: p.minAps })),
    });

    count += 1;
    if (count % 20 === 0) {
      // eslint-disable-next-line no-console
      console.log(`  …seeded ${count}/${CAREERS.length}`);
    }
  }
  const total = await prisma.career.count();
  // eslint-disable-next-line no-console
  console.log(`✅ Seeded ${count} careers (total in DB: ${total}) across 6 faculties and ${Object.keys(U).length} universities.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
