/** Class-level counts for the teacher dashboard. */

export function summarize(lessons, students) {
  const vocab = [];
  for (const lesson of lessons) {
    for (const word of lesson.vocabulary || []) {
      const clean = String(word || "").trim();
      if (!clean) continue;
      if (vocab.some((row) => row.word.toLowerCase() === clean.toLowerCase())) continue;
      vocab.push({ word: clean, unit: lesson.title || "Unit", count: 0 });
    }
  }
  for (const student of students) {
    for (const [word, n] of Object.entries(student.wordCounts || {})) {
      const row = vocab.find((item) => item.word.toLowerCase() === word.toLowerCase());
      if (row) row.count += Number(n) || 0;
    }
  }
  const byCount = (a, b) => b.count - a.count || a.word.localeCompare(b.word);
  const most = [...vocab].sort(byCount).slice(0, 5);
  const least = [...vocab].sort((a, b) => a.count - b.count || a.word.localeCompare(b.word)).slice(0, 5);

  const mistakes = students.flatMap((student) => student.mistakes || []);
  const patterns = new Map();
  const byKind = { grammar: 0, spelling: 0, word: 0 };
  for (const mistake of mistakes) {
    if (byKind[mistake.kind] != null) byKind[mistake.kind] += 1;
    const pattern = String(mistake.pattern || mistake.excerpt || "mistake").trim();
    const key = `${mistake.kind}|${pattern.toLowerCase()}`;
    const row = patterns.get(key) || {
      kind: mistake.kind,
      pattern,
      detail: mistake.detail || "",
      count: 0,
    };
    row.count += 1;
    patterns.set(key, row);
  }
  const common = [...patterns.values()].sort((a, b) => b.count - a.count || a.pattern.localeCompare(b.pattern)).slice(0, 5);
  const stories = students.reduce(
    (n, student) => n + (student.creations || []).filter((item) => item.kind === "story").length,
    0,
  );
  const activeMs = students.reduce((n, student) => n + (Number(student.activeMs) || 0), 0);
  return {
    students: students.length,
    stories,
    activeMin: Math.round(activeMs / 60000),
    most,
    least,
    common,
    byKind,
    mistakeCount: mistakes.length,
  };
}
