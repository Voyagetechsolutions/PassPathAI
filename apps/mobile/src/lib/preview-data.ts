const subjects = [
  { id: 'math-g10', name: 'Mathematics', code: 'MATH-G10', grade: 10 },
  { id: 'eng-g10', name: 'English First Additional Language', code: 'ENFAL-G10', grade: 10 },
  { id: 'life-g10', name: 'Life Sciences', code: 'LIFE-G10', grade: 10 },
  { id: 'physical-g10', name: 'Physical Sciences', code: 'PHSC-G10', grade: 10 },
  { id: 'geography-g10', name: 'Geography', code: 'GEOG-G10', grade: 10 },
  { id: 'zulu-g10', name: 'IsiZulu Home Language', code: 'ZUL-HL-G10', grade: 10 },
];

const additionalSubjects = [
  ['ACCN', 'Accounting'], ['AFR-FAL', 'Afrikaans First Additional Language'], ['AFR-HL', 'Afrikaans Home Language'],
  ['AGRM', 'Agricultural Management Practices'], ['AGRI', 'Agricultural Sciences'], ['AGRT', 'Agricultural Technology'],
  ['BSTD', 'Business Studies'], ['CAT', 'Computer Applications Technology'], ['CIVT', 'Civil Technology'],
  ['CONS', 'Consumer Studies'], ['DANC', 'Dance Studies'], ['DSGN', 'Design Studies'], ['DRAM', 'Dramatic Arts'],
  ['ECON', 'Economics'], ['ELET', 'Electrical Technology'], ['EGD', 'Engineering Graphics and Design'],
  ['ENG-HL', 'English Home Language'], ['EQUI', 'Equine Studies'], ['HIST', 'History'], ['HOSP', 'Hospitality Studies'],
  ['IT', 'Information Technology'], ['LFOR', 'Life Orientation'], ['MARI', 'Marine Sciences'], ['MARE', 'Maritime Economics'],
  ['MLIT', 'Mathematical Literacy'], ['MECT', 'Mechanical Technology'], ['MUSC', 'Music'], ['NAUT', 'Nautical Science'],
  ['RELS', 'Religion Studies'], ['NSO-FAL', 'Sepedi First Additional Language'], ['NSO-HL', 'Sepedi Home Language'],
  ['SOT-FAL', 'Sesotho First Additional Language'], ['SOT-HL', 'Sesotho Home Language'],
  ['TSW-FAL', 'Setswana First Additional Language'], ['TSW-HL', 'Setswana Home Language'],
  ['SSW-FAL', 'Siswati First Additional Language'], ['SSW-HL', 'Siswati Home Language'],
  ['SPRT', 'Sport and Exercise Science'], ['TMATH', 'Technical Mathematics'], ['TSCI', 'Technical Sciences'],
  ['TOUR', 'Tourism'], ['VEN-FAL', 'Tshivenda First Additional Language'], ['VEN-HL', 'Tshivenda Home Language'],
  ['TSO-FAL', 'Tsonga First Additional Language'], ['TSO-HL', 'Tsonga Home Language'], ['VART', 'Visual Arts'],
  ['NBL-FAL', 'isiNdebele First Additional Language'], ['NBL-HL', 'isiNdebele Home Language'],
  ['XHO-FAL', 'isiXhosa First Additional Language'], ['XHO-HL', 'isiXhosa Home Language'],
  ['ZUL-FAL', 'isiZulu First Additional Language'],
].map(([baseCode, name]) => ({
  id: `preview-${baseCode.toLowerCase()}`,
  name,
  code: `${baseCode}-G10`,
  grade: 10,
}));
const allGrade10Subjects = [...subjects, ...additionalSubjects].sort((a, b) => a.name.localeCompare(b.name));

type PreviewTopic = { id: string; title: string; description: string; orderIndex: number; importance: number };
const topic = (id: string, title: string, description: string, orderIndex: number): PreviewTopic => ({ id, title, description, orderIndex, importance: orderIndex === 1 ? 1 : 0.9 });
const topicsBySubjectId: Record<string, PreviewTopic[]> = {
  'math-g10': [
    topic('math-algebra', 'Algebraic Expressions', 'Factorisation, exponents, equations and inequalities', 1),
    topic('math-functions', 'Functions and Graphs', 'Linear, quadratic, hyperbolic and exponential relationships', 2),
    topic('math-geometry', 'Euclidean Geometry', 'Lines, angles, similarity and formal proofs', 3),
    topic('math-trigonometry', 'Trigonometry', 'Ratios, identities and solving right-angled triangles', 4),
  ],
  'eng-g10': [
    topic('eng-comprehension', 'Reading and Viewing', 'Comprehension, visual literacy and critical language awareness', 1),
    topic('eng-writing', 'Writing and Presenting', 'Essays, transactional texts, planning and editing', 2),
    topic('eng-language', 'Language Structures', 'Grammar, vocabulary, punctuation and sentence construction', 3),
    topic('eng-literature', 'Literature Study', 'Poetry, drama, novels and short stories', 4),
  ],
  'life-g10': [
    topic('life-cells', 'Cells: The Basic Units of Life', 'Cell structure, microscopy and movement across membranes', 1),
    topic('life-mitosis', 'Cell Division: Mitosis', 'The cell cycle, mitosis and growth', 2),
    topic('life-plant-animal', 'Plant and Animal Tissues', 'Tissue structure, function and organisation', 3),
    topic('life-ecosystems', 'Biosphere and Ecosystems', 'Ecology, energy flow and human impact', 4),
  ],
  'physical-g10': [
    topic('physical-matter', 'Matter and Materials', 'Particle models, classification and chemical bonding', 1),
    topic('physical-motion', 'Motion in One Dimension', 'Position, displacement, velocity and acceleration', 2),
    topic('physical-waves', 'Waves, Sound and Light', 'Transverse pulses, waves and electromagnetic radiation', 3),
    topic('physical-circuits', 'Electric Circuits', 'Current, potential difference, resistance and Ohm’s law', 4),
  ],
  'geography-g10': [
    topic('geography-maps', 'Mapwork Skills', 'Scale, direction, coordinates, contours and GIS', 1),
    topic('geography-atmosphere', 'The Atmosphere', 'Heating, moisture, climate and weather systems', 2),
    topic('geography-geomorphology', 'Geomorphology', 'Earth structure, plate tectonics and landforms', 3),
    topic('geography-population', 'Population', 'Distribution, growth, migration and development', 4),
  ],
  'zulu-g10': [
    topic('zulu-listening', 'Ukulalela Nokukhuluma', 'Listening comprehension, prepared and unprepared speaking', 1),
    topic('zulu-reading', 'Ukufunda Nokubukela', 'Comprehension, visual texts and summary writing', 2),
    topic('zulu-writing', 'Ukubhala Nokwethula', 'Essays, transactional writing, planning and editing', 3),
    topic('zulu-literature', 'Imibhalo', 'Poetry, drama, novels and traditional literature', 4),
  ],
};

const languageTopicTitles = ['Listening and speaking', 'Reading and viewing', 'Literature study', 'Writing: essays', 'Writing: transactional texts', 'Language structures and conventions'];
const subjectTopicTitles: Record<string, string[]> = {
  ACCN: ['Accounting concepts and ethics', 'Source documents and journals', 'Ledgers and trial balances', 'Financial statements', 'Cost accounting and budgeting'],
  AGRM: ['Crop production and management', 'Animal production and management', 'Natural resource management', 'Farm planning and records', 'Agricultural economics and marketing'],
  AGRI: ['Animal nutrition and production', 'Soil science', 'Plant production', 'Agricultural ecology', 'Agricultural chemistry and genetics'],
  AGRT: ['Safety and technical skills', 'Structures and construction', 'Machinery and mechanical systems', 'Electrical energy and control', 'Water supply and irrigation'],
  BSTD: ['Business environments', 'Forms of ownership', 'Entrepreneurship', 'Business operations', 'Business roles and ethics'],
  CAT: ['Computer hardware and software', 'Word processing', 'Spreadsheets and databases', 'Networks and internet technologies', 'Information management and solution development'],
  CIVT: ['Safety, materials and equipment', 'Graphics and communication', 'Construction processes', 'Surveying and setting out', 'Civil services and sustainable construction'],
  CONS: ['Consumer rights and resources', 'Food and nutrition', 'Clothing and textiles', 'Housing and interiors', 'Entrepreneurship and production'],
  DANC: ['Dance performance and technique', 'Improvisation and choreography', 'Dance theory and history', 'Anatomy and safe practice', 'Music and production for dance'],
  DSGN: ['The design process', 'Visual communication', 'Materials and production', 'Design history and context', 'Design business and presentation'],
  DRAM: ['Performance skills', 'Voice and body', 'Text and characterisation', 'Theatre history', 'South African theatre and production'],
  ECON: ['Basic economic concepts', 'Circular flow and economic systems', 'Markets and price determination', 'Public sector and banking', 'Growth, development and indicators'],
  ELET: ['Safety, tools and measurements', 'Electrical principles and circuits', 'Digital electronics', 'Power systems and machines', 'Control, testing and fault finding'],
  EGD: ['Design process and presentation', 'Mechanical drawings', 'Civil drawings', 'Descriptive and solid geometry', 'Perspective and computer-aided drawing'],
  EQUI: ['Equine anatomy and behaviour', 'Nutrition and feeding', 'Stable and pasture management', 'Health and first aid', 'Breeding and equine business'],
  HIST: ['Working with historical sources', 'Colonialism and expansion', 'Revolutions and social change', 'Southern African history', 'Twentieth-century conflict and democracy'],
  HOSP: ['Hospitality sectors and careers', 'Nutrition and menu planning', 'Food preparation and safety', 'Restaurant and accommodation services', 'Costing and entrepreneurship'],
  IT: ['Computer systems', 'Networks and internet technologies', 'Data and database management', 'Algorithms and programming', 'Solution development and social implications'],
  LFOR: ['Development of the self', 'Social and environmental responsibility', 'Democracy and human rights', 'Careers and study skills', 'Physical education'],
  MARI: ['Ocean systems', 'Marine biodiversity and ecology', 'Marine resources and conservation', 'Human impact on oceans', 'Marine research and South African coasts'],
  MARE: ['The maritime economy', 'Shipping and trade', 'Ports and logistics', 'Maritime finance and law', 'Sustainable maritime development'],
  MLIT: ['Numbers and calculations', 'Finance', 'Measurement', 'Maps and plans', 'Data handling and probability'],
  MECT: ['Safety, tools and materials', 'Mechanical drawings', 'Forces and motion', 'Manufacturing and joining', 'Engines, hydraulics and maintenance'],
  MUSC: ['Music performance', 'Music literacy and theory', 'Aural training', 'Composition and arrangement', 'Music history and technology'],
  NAUT: ['Navigation and charts', 'Seamanship', 'Marine meteorology', 'Ship stability and communication', 'Safety and maritime law'],
  RELS: ['Religions of the world', 'Teachings and sources', 'Rituals and sacred places', 'Religion and ethics', 'Religion and social issues'],
  SPRT: ['Anatomy and physiology', 'Biomechanics and movement', 'Fitness and conditioning', 'Sport nutrition and psychology', 'Injuries and sport management'],
  TMATH: ['Numbers, algebra and equations', 'Functions and graphs', 'Trigonometry', 'Geometry and measurement', 'Statistics, probability and calculus'],
  TSCI: ['Scientific skills', 'Mechanics', 'Matter and materials', 'Waves, heat and light', 'Electricity and chemical change'],
  TOUR: ['Tourism sectors', 'Map work and tour planning', 'Tourist attractions and heritage', 'Sustainable tourism', 'Marketing and customer care'],
  VART: ['Visual culture studies', 'Elements and principles of art', 'Drawing and visual investigation', 'Materials and practical work', 'African art and exhibition practice'],
};

for (const subject of additionalSubjects) {
  const baseCode = subject.code.replace(/-G10$/, '');
  const titles = /-(?:FAL|HL)$/.test(baseCode) || baseCode === 'ENG-HL'
    ? languageTopicTitles
    : subjectTopicTitles[baseCode] ?? ['Foundations and terminology', 'Core knowledge and skills', 'Applied problem solving', 'Practical and project work', 'Assessment and exam preparation'];
  topicsBySubjectId[subject.id] = titles.map((title, index) => topic(`${baseCode.toLowerCase()}-${index + 1}`, title, `${title} in the Grade 10 CAPS curriculum.`, index + 1));
}

const allTopics = Object.values(topicsBySubjectId).flat();
const topicContext = (topicId: string) => {
  const subject = allGrade10Subjects.find((item) => topicsBySubjectId[item.id]?.some((itemTopic) => itemTopic.id === topicId)) ?? subjects[0];
  const selectedTopic = topicsBySubjectId[subject.id]?.find((item) => item.id === topicId) ?? topicsBySubjectId['math-g10'][0];
  return { subject, topic: selectedTopic };
};

const marks = [
  { subjectName: 'Mathematics', mark: 72 },
  { subjectName: 'English First Additional Language', mark: 68 },
  { subjectName: 'Life Sciences', mark: 76 },
  { subjectName: 'Physical Sciences', mark: 73 },
  { subjectName: 'Geography', mark: 65 },
  { subjectName: 'IsiZulu Home Language', mark: 82 },
];

const pastPapers = [
  { id: 'preview-math-paper-1', title: 'Mathematics Paper 1', grade: 10, year: 2024, kind: 'Paper 1', mimeType: 'application/pdf', subject: subjects[0], fileUrl: 'http://localhost:8081/preview-papers/mathematics-paper-1.pdf' },
  { id: 'preview-life-memo-1', title: 'Life Sciences Memo 1', grade: 10, year: 2023, kind: 'Memo', mimeType: 'application/pdf', subject: subjects[2], fileUrl: 'http://localhost:8081/preview-papers/life-sciences-memo-1.pdf' },
  { id: 'preview-physical-paper-1', title: 'Physical Sciences Paper 1', grade: 10, year: 2023, kind: 'Paper 1', mimeType: 'application/pdf', subject: subjects[3], fileUrl: 'http://localhost:8081/preview-papers/physical-sciences-paper-1.pdf' },
  { id: 'preview-geography-memo-1', title: 'Geography Memo 1', grade: 10, year: 2023, kind: 'Memo', mimeType: 'application/pdf', subject: subjects[4], fileUrl: 'http://localhost:8081/preview-papers/geography-memo-1.pdf' },
];

const careers = [
  {
    careerId: 'software-engineer', title: 'Software Engineer', description: 'Design and build reliable digital products.', faculty: 'Engineering', eligible: true,
    admissionLikelihood: 0.86, computedAps: 35, unmetSubjects: [],
    programmes: [
      { university: 'University of Pretoria', programmeName: 'BSc Computer Science', minAps: 30, apsMet: true, requirementsMet: true },
      { university: 'University of Johannesburg', programmeName: 'BSc Information Technology', minAps: 28, apsMet: true, requirementsMet: true },
    ],
  },
  {
    careerId: 'data-scientist', title: 'Data Scientist', description: 'Use mathematics and computing to find useful patterns.', faculty: 'Science', eligible: true,
    admissionLikelihood: 0.78, computedAps: 35, unmetSubjects: [],
    programmes: [{ university: 'University of Cape Town', programmeName: 'BSc Data Science', minAps: 34, apsMet: true, requirementsMet: true }],
  },
  {
    careerId: 'civil-engineer', title: 'Civil Engineer', description: 'Design roads, bridges, water systems and sustainable infrastructure.', faculty: 'Engineering', eligible: true,
    admissionLikelihood: 0.75, computedAps: 35, unmetSubjects: [],
    programmes: [
      { university: 'University of the Witwatersrand', programmeName: 'BSc Engineering (Civil)', minAps: 36, apsMet: false, requirementsMet: true },
      { university: 'University of Pretoria', programmeName: 'BEng Civil Engineering', minAps: 35, apsMet: true, requirementsMet: true },
    ],
  },
  {
    careerId: 'medical-doctor', title: 'Medical Doctor', description: 'Diagnose illness, treat patients and improve community health.', faculty: 'Health Sciences & Medicine', eligible: false,
    admissionLikelihood: 0.72, computedAps: 35, unmetSubjects: [],
    programmes: [
      { university: 'University of KwaZulu-Natal', programmeName: 'MBChB', minAps: 40, apsMet: false, requirementsMet: true },
      { university: 'Sefako Makgatho Health Sciences University', programmeName: 'MBChB', minAps: 38, apsMet: false, requirementsMet: true },
    ],
  },
  {
    careerId: 'chartered-accountant', title: 'Chartered Accountant', description: 'Lead financial reporting, assurance and business decision-making.', faculty: 'Commerce, Finance & Management Sciences', eligible: false,
    admissionLikelihood: 0.7, computedAps: 35, unmetSubjects: ['Accounting'],
    programmes: [
      { university: 'Stellenbosch University', programmeName: 'BAcc', minAps: 36, apsMet: false, requirementsMet: false },
      { university: 'University of Johannesburg', programmeName: 'BCom Accounting', minAps: 32, apsMet: true, requirementsMet: false },
    ],
  },
  {
    careerId: 'attorney', title: 'Attorney', description: 'Advise clients, prepare legal matters and represent people and organisations.', faculty: 'Law & Humanities', eligible: true,
    admissionLikelihood: 0.68, computedAps: 35, unmetSubjects: [],
    programmes: [
      { university: 'University of the Free State', programmeName: 'LLB', minAps: 33, apsMet: true, requirementsMet: true },
      { university: 'University of South Africa', programmeName: 'LLB', minAps: 28, apsMet: true, requirementsMet: true },
    ],
  },
];

const previewCareerRequirements: Record<string, Array<{ subjectName: string; minPercent: number }>> = {
  'software-engineer': [{ subjectName: 'Mathematics', minPercent: 60 }, { subjectName: 'English First Additional Language', minPercent: 50 }],
  'data-scientist': [{ subjectName: 'Mathematics', minPercent: 70 }, { subjectName: 'English First Additional Language', minPercent: 50 }],
  'civil-engineer': [{ subjectName: 'Mathematics', minPercent: 70 }, { subjectName: 'Physical Sciences', minPercent: 70 }, { subjectName: 'English First Additional Language', minPercent: 50 }],
  'medical-doctor': [{ subjectName: 'Mathematics', minPercent: 70 }, { subjectName: 'Physical Sciences', minPercent: 70 }, { subjectName: 'Life Sciences', minPercent: 70 }, { subjectName: 'English First Additional Language', minPercent: 60 }],
  'chartered-accountant': [{ subjectName: 'Mathematics', minPercent: 70 }, { subjectName: 'Accounting', minPercent: 60 }, { subjectName: 'English First Additional Language', minPercent: 50 }],
  attorney: [{ subjectName: 'English First Additional Language', minPercent: 60 }],
};

export function previewResponse(path: string, method: string, body?: unknown): unknown {
  if (path === '/profile/me') return { id: 'preview-student', firstName: 'Thabo', surname: 'Mokoena', grade: 10, school: 'PassPath Preview School', syllabus: 'CAPS', onboarded: true, subjects, marks };
  if (path === '/profile/marks') return marks;
  if (path === '/dashboard') return { predictedScore: 71, predictionConfidence: 0.82, masteryScore: 64, completedTopics: 7, totalTrackedTopics: 12, weakTopics: [{ topicId: 'algebra', title: 'Algebraic Expressions', weaknessScore: 0.68 }], streak: { currentStreak: 4, longestStreak: 9, lastActiveDate: new Date().toISOString() } };
  if (path === '/dashboard/predictions') return [58, 61, 64, 68, 71].map((predictedScore, i) => ({ id: `p${i}`, predictedScore, confidence: 0.8, createdAt: new Date(Date.now() - (4 - i) * 86400000).toISOString() }));
  if (path === '/roadmap/today') return { goalCount: 3, completedCount: 1, allDone: false, activeToday: true, streak: { current: 4, longest: 9 }, tasks: [{ missionId: 'm1', topicId: 'algebra', title: 'Practise factorisation', subjectId: 'math-g10', subjectName: 'Mathematics', done: false }, { missionId: 'm2', topicId: 'geometry', title: 'Review angle theorems', subjectId: 'math-g10', subjectName: 'Mathematics', done: true }, { missionId: 'm3', topicId: 'functions', title: 'Complete a graph quiz', subjectId: 'math-g10', subjectName: 'Mathematics', done: false }] };
  if (path === '/countdown') return { yearEnd: { date: '2026-12-04', daysRemaining: 111 }, nextExam: { id: 'e1', title: 'Mathematics Paper 1', date: '2026-09-10', daysRemaining: 26, subject: subjects[0] }, matricFinals: { date: '2026-10-20', daysRemaining: 66, year: 2026 }, exams: [] };
  if (path === '/weakness/mastery') return allTopics.map((item, i) => { const context = topicContext(item.id); return { topicId: item.id, masteryScore: [0.42, 0.78, 0.61, 0.7][i % 4], topic: { id: item.id, title: item.title, subjectId: context.subject.id } }; });
  if (path.startsWith('/curriculum/subjects?')) return allGrade10Subjects;
  if (path.startsWith('/curriculum/subjects/')) { const id = path.split('/').pop()!; const subject = allGrade10Subjects.find((item) => item.id === id) ?? subjects[0]; return { ...subject, topics: topicsBySubjectId[subject.id] ?? [] }; }
  if (path.startsWith('/past-papers')) return pastPapers;
  if (path === '/careers/recommended') return careers;
  if (path.startsWith('/careers/')) {
    const careerId = path.split('/').pop();
    const match = careers.find((item) => item.careerId === careerId);
    if (!match) return null;
    const subjectRequirements = previewCareerRequirements[match.careerId] ?? [];
    return {
      id: match.careerId,
      title: match.title,
      description: match.description,
      faculty: match.faculty,
      subjectRequirements,
      programmes: match.programmes.map((programme, index) => ({
        id: `${match.careerId}-programme-${index}`,
        university: programme.university,
        programmeName: programme.programmeName,
        minAps: programme.minAps,
        requirements: subjectRequirements,
      })),
    };
  }
  if (path === '/subscription/me') return { isPremium: false, status: 'FREE', currentPeriodEnd: null, cancelAtPeriodEnd: false, priceLabel: 'R99/month' };
  if (path === '/admin/stats') return { content: { subjects: 24, questions: 860, lessons: 190, careers: 85 }, users: { total: 1280, students: 1110, parents: 160, onboarded: 1044 }, engagement: { activeToday: 186, activeThisWeek: 620, diagnosticAttempts: 3400, avgDiagnosticScore: 67, avgStreak: 4.2, longestStreak: 38, aiQueries: 9200 } };
  if (path === '/social/summary') return { studiedToday: true, rewardPoints: 120, rewards: [{ id: 'r1', title: 'Four-day flame', description: 'Studied four days in a row', icon: '🔥', points: 40, earnedAt: new Date().toISOString() }], pending: [{ id: 'pending-1', friend: { id: 'u2', firstName: 'Lerato', surname: 'Dlamini', email: 'lerato@example.com' } }], outgoing: [{ id: 'outgoing-1', friend: { id: 'u3', firstName: 'Sipho', surname: 'Khumalo', email: 'sipho@example.com' } }], friends: [{ id: 'friend-1', friend: { id: 'u4', firstName: 'Amahle', surname: 'Nkosi', email: 'amahle@example.com' }, streak: { currentStreak: 6, longestStreak: 11 }, lastMessage: { content: 'Ready for the maths quiz?' } }] };
  if (path.includes('/social/friends/') && path.endsWith('/messages')) return method === 'POST' ? { id: 'msg-new', content: 'Preview message', senderId: 'preview-student', createdAt: new Date().toISOString() } : [{ id: 'msg-1', content: 'Ready for the maths quiz?', senderId: 'u4', createdAt: new Date().toISOString() }];
  if (path.startsWith('/calendar?')) return { month: path.split('month=')[1] ?? '2026-08', learned: [{ date: '2026-08-14', topics: [{ topicId: 'algebra', title: 'Algebraic Expressions', subjectName: 'Mathematics' }] }], exams: [{ id: 'exam-1', date: '2026-09-10', title: 'Mathematics Paper 1', subjectName: 'Mathematics', editable: true }] };
  if (path === '/exams/generate') {
    const subjectId = typeof body === 'object' && body && 'subjectId' in body ? String(body.subjectId) : subjects[0].id;
    return { id: `preview-exam-${encodeURIComponent(subjectId)}` };
  }
  if (path.startsWith('/tutor/topic/') && path.endsWith('/start')) { const topicId = path.split('/')[3]; const context = topicContext(topicId); return { conversationId: `preview-${topicId}`, topicTitle: context.topic.title, subjectName: context.subject.name, understandingScore: 6, starters: [{ key: 'explain', label: 'Explain this simply' }, { key: 'example', label: 'Show me a worked example' }], messages: [{ role: 'assistant', content: `Let’s work through ${context.topic.title} in ${context.subject.name}. What would you like to understand first?` }], messagesRemaining: 5, limitReached: false, requiresPremium: false }; }
  if (path.startsWith('/tutor/topic/') && path.endsWith('/message')) { const topicId = path.split('/')[3]; const context = topicContext(topicId); return { reply: `${context.topic.title} focuses on ${context.topic.description.toLowerCase()}. I can explain the key idea, show a worked example, or help you practise it step by step.`, userContent: 'Explain this simply', messagesRemaining: 4, limitReached: false, requiresPremium: false }; }
  if (path.startsWith('/tutor/topic/') && path.endsWith('/rate')) return { score: 7, feedback: 'Good explanation. Add one worked example to make it complete.', strengths: ['You identified the common factor.'], gaps: ['Show how to check by expanding.'], understandingScore: 7 };
  if (path.startsWith('/practice/topic/') && path.endsWith('/next')) { const topicId = path.split('/')[3]; const context = topicContext(topicId); return { questionId: `practice-${topicId}`, prompt: `Which statement best describes the focus of ${context.topic.title}?`, difficulty: 'MEDIUM', masteryScore: 42, options: [{ label: 'A', text: context.topic.description }, { label: 'B', text: 'A topic from a different subject' }, { label: 'C', text: 'Only memorising definitions' }, { label: 'D', text: 'None of these' }] }; }
  if (path === '/practice/answer') return { correct: true, masteryScore: 48, message: 'Correct — that matches the CAPS focus for this topic.', correctLabel: 'A', correctText: 'The subject-specific description shown above', explanation: 'The answer identifies the central knowledge and skills covered by this topic.' };
  if (path.startsWith('/diagnostics/') && path.endsWith('/start')) return { attemptId: 'diagnostic-attempt', title: 'Algebra check-in', questions: [{ id: 'dq1', prompt: 'Which expression is a difference of two squares?', type: 'MULTIPLE_CHOICE', marks: 1, options: [{ id: 'do1', label: 'A', text: 'x² − 9' }, { id: 'do2', label: 'B', text: 'x² + 9' }] }] };
  if (path.startsWith('/exams/') && path.endsWith('/start')) {
    const encodedSubjectId = path.slice('/exams/preview-exam-'.length, -'/start'.length);
    const subjectId = decodeURIComponent(encodedSubjectId || subjects[0].id);
    const subject = allGrade10Subjects.find((item) => item.id === subjectId) ?? subjects[0];
    const selectedTopics = (topicsBySubjectId[subject.id] ?? topicsBySubjectId['math-g10']).slice(0, 2);
    const firstTopic = selectedTopics[0];
    const secondTopic = selectedTopics[1] ?? firstTopic;
    return {
      attemptId: `exam-attempt-${subject.id}`,
      title: `${subject.name} mock exam`,
      durationMins: 60,
      totalMarks: 4,
      sections: [{
        title: firstTopic.title,
        items: [
          { examItemId: `ei-${subject.id}-1`, marks: 1, prompt: `Which option best describes ${firstTopic.title}?`, type: 'MULTIPLE_CHOICE', options: [{ label: 'A', text: firstTopic.description }, { label: 'B', text: secondTopic.description }] },
          { examItemId: `ei-${subject.id}-2`, marks: 3, prompt: `Explain one important idea from ${secondTopic.title} and give a relevant example.`, type: 'SHORT_ANSWER', options: [] },
        ],
      }],
    };
  }
  if (path.startsWith('/exams/attempts/') && path.endsWith('/submit')) return { scorePercent: 75, marksAwarded: 3, totalMarks: 4, sections: [{ title: 'CAPS topic assessment', awarded: 3, total: 4 }], responses: [{ examItemId: 'preview-written', prompt: 'Written response', type: 'SHORT_ANSWER', marksAwarded: 2, maxMarks: 3, feedback: 'Good subject knowledge. Add one more precise CAPS term or example for full marks.' }] };
  return {};
}
