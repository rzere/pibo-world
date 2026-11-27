const app = document.getElementById("app");
const who = document.getElementById("who");

const state = { me: null, detail: null };

document.getElementById("sign-out").addEventListener("click", async () => {
  await fetch("/api/auth", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "signout" }),
  });
  location.href = "/";
});

boot();
window.addEventListener("popstate", route);

async function boot() {
  const res = await fetch("/api/auth", { credentials: "include" });
  const me = res.ok ? await res.json() : null;
  if (!me || me.role !== "teacher") {
    location.replace("/?as=teacher");
    return;
  }
  state.me = me;
  who.textContent = me.name || me.username;
  route();
}

function route() {
  const params = new URLSearchParams(location.search);
  const worldId = params.get("world");
  const studentId = params.get("student");
  if (worldId && studentId) showStudent(worldId, studentId);
  else if (worldId) showWorld(worldId);
  else showWorlds();
}

function go(params) {
  const url = new URL(location.href);
  url.search = new URLSearchParams(params).toString();
  history.pushState(null, "", url);
  route();
}

async function api(action, body = {}) {
  const res = await fetch("/api/class", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    location.replace("/?as=teacher");
    return null;
  }
  if (!res.ok) throw new Error(data.error || "That did not work.");
  return data;
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function field(label, control) {
  const wrap = el("label", "field");
  wrap.append(el("span", "field-label", label), control);
  return wrap;
}

function input(value, placeholder) {
  const node = el("input", "field-input");
  node.value = value || "";
  if (placeholder) node.placeholder = placeholder;
  return node;
}

function area(value, placeholder) {
  const node = el("textarea", "field-input");
  node.rows = 4;
  node.value = value || "";
  if (placeholder) node.placeholder = placeholder;
  return node;
}

function formatActive(ms) {
  const min = Math.max(0, Math.round((Number(ms) || 0) / 60000));
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function formatWhen(iso) {
  if (!iso) return "Not yet";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function kindLabel(kind) {
  if (kind === "spelling") return "Spelling";
  if (kind === "word") return "Word choice";
  return "Grammar";
}

function detectorLabel(detector) {
  if (detector === "claude") return "Claude";
  if (detector === "rules") return "Rules";
  return "Sample";
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const previous = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => { button.textContent = previous; }, 1200);
  } catch {
    button.textContent = "Copy failed";
  }
}

function banner(demo) {
  if (!demo) return null;
  const node = el("div", "banner");
  node.append(el("strong", null, "Demo data. "));
  node.append(document.createTextNode("Mint Garden and its four students are samples for the thesis, not real children. Demo sign-in is username demo (teacher) or lina, omar, mei, sam (students). Password for every demo account: demo-class."));
  return node;
}

function persistenceNote(mode) {
  if (mode !== "ephemeral") return null;
  return el("div", "banner", "New classes will disappear when this server sleeps. Set BLOB_READ_WRITE_TOKEN so Vercel Blob keeps them. The README has the steps.");
}

async function showWorlds() {
  app.replaceChildren(el("p", "lede", "Loading your classes…"));
  let data;
  try {
    data = await api("list");
  } catch (err) {
    app.replaceChildren(el("p", "error", err.message));
    return;
  }
  if (!data) return;
  const page = el("div");
  const head = el("div");
  head.append(el("h1", null, "Your class worlds"));
  head.append(el("p", "lede", "Each world has a join code. Students use it when they create an account, then practice your words on the island."));
  page.append(head);
  if (state.me.demo) page.append(banner(true));
  const note = persistenceNote(data.persistence);
  if (note) page.append(note);

  const layout = el("div", "layout");
  const listCard = el("section", "card");
  listCard.append(el("h2", null, "Worlds"));
  const list = el("div", "world-list");
  if (!data.worlds.length) list.append(el("p", "lede", "No worlds yet. Create the first one."));
  for (const world of data.worlds) {
    const button = el("button", "world-card");
    button.type = "button";
    const text = el("div");
    const title = el("b", null, world.name);
    if (world.demo) title.append(document.createTextNode(" "), el("span", "badge", "Demo"));
    text.append(title);
    text.append(el("span", null, `${world.level || "No level yet"} · ${world.students} students · ${world.lessons} units`));
    button.append(text, el("span", "code-pill", world.code));
    button.addEventListener("click", () => go({ world: world.id }));
    list.append(button);
  }
  listCard.append(list);

  const formCard = el("section", "card");
  formCard.id = "new-world";
  formCard.append(el("h2", null, "New class world"));
  const name = input("", "Thursday English");
  const description = area("", "What this class is working on");
  description.rows = 3;
  const level = input("", "A1 · ages 9–10");
  const error = el("p", "error");
  const button = el("button", "go", "Create world");
  button.type = "button";
  button.addEventListener("click", async () => {
    error.textContent = "";
    button.disabled = true;
    try {
      const created = await api("createWorld", {
        name: name.value,
        description: description.value,
        level: level.value,
      });
      if (created?.world) go({ world: created.world.id });
    } catch (err) {
      error.textContent = err.message;
      button.disabled = false;
    }
  });
  formCard.append(
    field("Name", name),
    field("Description", description),
    field("Class level", level),
    button,
    error,
  );
  layout.append(listCard, formCard);
  page.append(layout);
  app.replaceChildren(page);
}

async function showWorld(worldId) {
  app.replaceChildren(el("p", "lede", "Loading the class…"));
  let data;
  try {
    data = await api("detail", { worldId });
  } catch (err) {
    app.replaceChildren(el("p", "error", err.message));
    return;
  }
  if (!data) return;
  state.detail = data;
  const { world, lessons, students, summary } = data;
  const page = el("div");
  const back = el("a", "back", "All worlds");
  back.href = "/teacher/";
  back.addEventListener("click", (event) => {
    event.preventDefault();
    history.pushState(null, "", "/teacher/");
    route();
  });
  page.append(back);
  const title = el("div", "title-row");
  const heading = el("h1", null, world.name);
  if (world.demo) heading.append(document.createTextNode(" "), el("span", "badge", "Demo"));
  title.append(heading);
  page.append(title);
  if (world.description) page.append(el("p", "lede", world.description));
  if (world.demo) page.append(banner(true));
  const persist = persistenceNote(data.persistence);
  if (persist) page.append(persist);

  const code = el("section", "card code-box");
  const codeText = el("div");
  codeText.append(el("span", "field-label", "Join code"));
  codeText.append(el("strong", null, world.code));
  const link = `${location.origin}/?code=${encodeURIComponent(world.code)}`;
  codeText.append(el("small", null, link));
  const copies = el("div", "row-actions");
  const copyCode = el("button", "quiet", "Copy code");
  copyCode.type = "button";
  copyCode.addEventListener("click", () => copyText(world.code, copyCode));
  const copyLink = el("button", "quiet", "Copy join link");
  copyLink.type = "button";
  copyLink.addEventListener("click", () => copyText(link, copyLink));
  copies.append(copyCode, copyLink);
  code.append(codeText, copies);
  page.append(code);

  page.append(editWorld(world));
  page.append(materialSection(world, lessons));
  page.append(summarySection(summary));
  page.append(studentSection(world, students));
  app.replaceChildren(page);
}

function editWorld(world) {
  const card = el("section", "card section");
  card.append(el("h2", null, "World details"));
  const name = input(world.name);
  const description = area(world.description);
  description.rows = 2;
  const level = input(world.level, "A2");
  const error = el("p", "error");
  const save = el("button", "primary", "Save details");
  save.type = "button";
  save.addEventListener("click", async () => {
    error.textContent = "";
    save.disabled = true;
    try {
      await api("updateWorld", {
        worldId: world.id,
        name: name.value,
        description: description.value,
        level: level.value,
      });
      showWorld(world.id);
    } catch (err) {
      error.textContent = err.message;
      save.disabled = false;
    }
  });
  const remove = el("button", "ghost", "Delete this world");
  remove.type = "button";
  remove.addEventListener("click", async () => {
    if (!confirm(`Delete ${world.name}? Student accounts in this world are removed too.`)) return;
    await api("deleteWorld", { worldId: world.id });
    history.pushState(null, "", "/teacher/");
    route();
  });
  const actions = el("div", "row-actions");
  actions.append(save, remove);
  card.append(field("Name", name), field("Description", description), field("Class level", level), actions, error);
  return card;
}

function materialSection(world, lessons) {
  const card = el("section", "card section");
  card.id = "material";
  card.append(el("h2", null, "Class material"));
  card.append(el("p", "lede", "Words, grammar, and a short text for each unit. The unit marked “in the game” is what animals, stories, and ideas use."));
  for (const lesson of lessons) card.append(lessonForm(world, lesson));
  card.append(lessonForm(world, {
    id: "",
    title: "",
    topic: "",
    vocabulary: [],
    grammar: [],
    text: "",
    active: lessons.length === 0,
  }, true));
  return card;
}

function lessonForm(world, lesson, fresh) {
  const form = el("form", "unit");
  const head = el("header");
  head.append(el("h3", null, fresh ? "Add a unit" : lesson.title));
  if (lesson.active && !fresh) head.append(el("span", "badge", "In the game"));
  form.append(head);
  const title = input(lesson.title, "Food I like");
  const topic = input(lesson.topic, "Food");
  const vocabulary = area((lesson.vocabulary || []).join("\n"), "One word or phrase per line");
  vocabulary.rows = 6;
  const grammar = area((lesson.grammar || []).join("\n"), "One structure per line, such as I like");
  grammar.rows = 3;
  const text = area(lesson.text, "A sentence or topic students will talk about");
  text.rows = 2;
  const active = el("input");
  active.type = "checkbox";
  active.checked = !!lesson.active;
  const check = el("label", "check");
  check.append(active, document.createTextNode(" Use this unit in the game"));
  const error = el("p", "error");
  const save = el("button", "primary", fresh ? "Add unit" : "Save unit");
  save.type = "submit";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    save.disabled = true;
    try {
      await api("saveLesson", {
        worldId: world.id,
        id: lesson.id,
        title: title.value,
        topic: topic.value,
        vocabulary: vocabulary.value,
        grammar: grammar.value,
        text: text.value,
        active: active.checked,
      });
      showWorld(world.id);
    } catch (err) {
      error.textContent = err.message;
      save.disabled = false;
    }
  });
  const actions = el("div", "row-actions");
  actions.append(save);
  if (!fresh) {
    const remove = el("button", "ghost", "Delete unit");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      if (!confirm(`Delete ${lesson.title}?`)) return;
      await api("deleteLesson", { worldId: world.id, id: lesson.id });
      showWorld(world.id);
    });
    actions.append(remove);
  }
  form.append(
    field("Unit title", title),
    field("Topic", topic),
    field("Vocabulary", vocabulary),
    field("Grammar points", grammar),
    field("Short text or topic", text),
    check,
    actions,
    error,
  );
  return form;
}

function summarySection(summary) {
  const wrap = el("section", "section");
  wrap.id = "students";
  wrap.append(el("h2", null, "How the class is doing"));
  const grid = el("div", "summary");
  grid.append(wordCard("Most practiced words", summary.most, false));
  grid.append(wordCard("Least practiced words", summary.least, true));
  const mistakes = el("article", "card");
  mistakes.append(el("h3", null, "Most common mistakes"));
  const kinds = summary.byKind || {};
  mistakes.append(el("p", "meta", `${kinds.grammar || 0} grammar · ${kinds.spelling || 0} spelling · ${kinds.word || 0} word choice`));
  if (!summary.common?.length) mistakes.append(el("p", "lede", "No mistakes logged yet."));
  else {
    const list = el("ul");
    for (const row of summary.common) {
      const item = el("li");
      item.append(el("span", `pill ${row.kind}`, kindLabel(row.kind)));
      item.append(document.createTextNode(`${row.pattern} · ${row.count}`));
      list.append(item);
    }
    mistakes.append(list);
  }
  grid.append(mistakes);
  wrap.append(grid);
  return wrap;
}

function wordCard(title, rows, least) {
  const card = el("article", "card");
  card.append(el("h3", null, title));
  if (!rows?.length) {
    card.append(el("p", "lede", "Add vocabulary to a unit to see this."));
    return card;
  }
  const list = el("ul");
  for (const row of rows) {
    const item = el("li", row.count ? "" : "zero");
    item.textContent = `${row.word} · ${row.count ? row.count : "not yet"} · ${row.unit}`;
    list.append(item);
  }
  card.append(list);
  if (least) card.append(el("p", "meta", "Includes words from every unit, even ones not used yet."));
  return card;
}

function studentSection(world, students) {
  const card = el("section", "card section");
  card.append(el("h2", null, "Students"));
  card.append(el("p", "lede", "They join with the class code, or you can make an account and give them the username and password. Passwords are stored only as a hash."));
  if (!students.length) card.append(el("p", null, "No students yet."));
  else {
    const wrap = el("div", "table-wrap");
    const table = el("table");
    const thead = el("thead");
    const head = el("tr");
    for (const label of ["Student", "Time active", "Sessions", "Stories", "Mistakes", "Last seen"]) {
      head.append(el("th", null, label));
    }
    thead.append(head);
    const body = el("tbody");
    for (const student of students) {
      const stories = (student.creations || []).filter((item) => item.kind === "story").length;
      const row = el("tr", "student");
      const name = el("td");
      const strong = el("b", null, student.nickname);
      if (student.demo) strong.append(document.createTextNode(" "), el("span", "badge", "Demo"));
      name.append(strong, el("div", "meta", student.username));
      row.append(
        name,
        el("td", null, formatActive(student.activeMs)),
        el("td", null, String(student.sessions || 0)),
        el("td", null, String(stories)),
        el("td", null, String((student.mistakes || []).length)),
        el("td", null, formatWhen(student.lastSeenAt)),
      );
      row.addEventListener("click", () => go({ world: world.id, student: student.id }));
      body.append(row);
    }
    table.append(thead, body);
    wrap.append(table);
    card.append(wrap);
  }
  card.append(newStudentForm(world));
  return card;
}

function newStudentForm(world) {
  const form = el("form", "unit");
  form.append(el("h3", null, "Create a student account"));
  const nickname = input("", "e.g. Nia");
  const username = input("", "e.g. nia");
  const password = input("", "At least 6 characters");
  password.type = "password";
  password.autocomplete = "new-password";
  const show = el("input");
  show.type = "checkbox";
  show.addEventListener("change", () => {
    password.type = show.checked ? "text" : "password";
  });
  const toggle = el("label", "check");
  toggle.append(show, document.createTextNode(" Show password while you write it down"));
  const error = el("p", "error");
  const save = el("button", "primary", "Create account");
  save.type = "submit";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    save.disabled = true;
    try {
      await api("createStudent", {
        worldId: world.id,
        nickname: nickname.value,
        username: username.value,
        password: password.value,
      });
      showWorld(world.id);
    } catch (err) {
      error.textContent = err.message;
      save.disabled = false;
    }
  });
  form.append(
    field("Name in the game", nickname),
    field("Username", username),
    field("Password", password),
    toggle,
    save,
    error,
  );
  return form;
}

async function showStudent(worldId, studentId) {
  if (!state.detail || state.detail.world.id !== worldId) {
    try {
      state.detail = await api("detail", { worldId });
    } catch (err) {
      app.replaceChildren(el("p", "error", err.message));
      return;
    }
  }
  if (!state.detail) return;
  const student = state.detail.students.find((item) => item.id === studentId);
  if (!student) {
    app.replaceChildren(el("p", "error", "That student is not in this world."));
    return;
  }
  const lessons = state.detail.lessons || [];
  const page = el("div");
  const back = el("a", "back", state.detail.world.name);
  back.href = `/teacher/?world=${encodeURIComponent(worldId)}`;
  back.addEventListener("click", (event) => {
    event.preventDefault();
    go({ world: worldId });
  });
  page.append(back);
  const title = el("h1", null, student.nickname);
  if (student.demo) title.append(document.createTextNode(" "), el("span", "badge", "Demo"));
  page.append(title);
  page.append(el("p", "lede", `Username ${student.username} · joined ${formatWhen(student.createdAt)}`));

  const stats = el("div", "stats");
  const stories = (student.creations || []).filter((item) => item.kind === "story").length;
  for (const [value, label] of [
    [formatActive(student.activeMs), "Time active"],
    [String(student.sessions || 0), "Sessions"],
    [String(stories), "Stories"],
    [String((student.mistakes || []).length), "Mistakes"],
  ]) {
    const tile = el("div", "stat");
    tile.append(el("b", null, value), el("span", null, label));
    stats.append(tile);
  }
  page.append(stats);
  page.append(wordBars(student, lessons));
  page.append(grammarBlock(student));
  page.append(creationBlock(student));
  page.append(mistakeBlock(student));
  page.append(lineBlock(student));
  app.replaceChildren(page);
}

function wordBars(student, lessons) {
  const card = el("section", "card section");
  card.append(el("h2", null, "Target words"));
  const counts = student.wordCounts || {};
  const words = [];
  for (const lesson of lessons) {
    for (const word of lesson.vocabulary || []) {
      if (!words.some((item) => item.toLowerCase() === word.toLowerCase())) words.push(word);
    }
  }
  for (const word of Object.keys(counts)) {
    if (!words.some((item) => item.toLowerCase() === word.toLowerCase())) words.push(word);
  }
  if (!words.length) {
    card.append(el("p", "lede", "No target words yet."));
    return card;
  }
  const max = Math.max(1, ...words.map((word) => Number(counts[word]) || 0));
  const bars = el("div", "bars");
  for (const word of words) {
    const count = Number(counts[word]) || 0;
    const row = el("div", "bar-row");
    row.append(el("span", null, word));
    const track = el("div", "track");
    const fill = el("div", count ? "fill" : "fill low");
    fill.style.width = `${Math.round((count / max) * 100)}%`;
    track.append(fill);
    row.append(track, el("span", null, String(count)));
    bars.append(row);
  }
  card.append(bars);
  return card;
}

function grammarBlock(student) {
  const card = el("section", "card section");
  card.append(el("h2", null, "Target grammar used"));
  const entries = Object.entries(student.grammarCounts || {});
  if (!entries.length) {
    card.append(el("p", "lede", "None of the target structures showed up in their English yet."));
    return card;
  }
  const row = el("div", "chip-row");
  for (const [phrase, count] of entries) row.append(el("span", "code-pill", `${phrase} · ${count}`));
  card.append(row);
  return card;
}

function creationBlock(student) {
  const card = el("section", "card section");
  card.id = "creations";
  card.append(el("h2", null, "Creations"));
  const items = student.creations || [];
  if (!items.length) {
    card.append(el("p", "lede", "No stories or ideas yet."));
    return card;
  }
  for (const item of items) {
    const block = el("article", "creation");
    block.append(el("div", "meta", `${item.kind} · ${formatWhen(item.at)}`));
    if (item.title) block.append(el("b", null, item.title));
    block.append(el("p", "quote", item.text));
    card.append(block);
  }
  return card;
}

function mistakeBlock(student) {
  const card = el("section", "card section");
  card.id = "mistakes";
  card.append(el("h2", null, "Mistakes"));
  card.append(el("p", "lede", "Spotted in English they typed while talking to animals, writing stories, or making a show. The island does not scold them."));
  const items = student.mistakes || [];
  if (!items.length) {
    card.append(el("p", null, "No mistakes logged."));
    return card;
  }
  for (const item of items) {
    const block = el("article", `mistake ${item.kind}`);
    const head = el("div");
    head.append(el("span", `pill ${item.kind}`, kindLabel(item.kind)));
    head.append(el("b", null, item.pattern || item.excerpt));
    block.append(head);
    block.append(el("div", "meta", `${formatWhen(item.at)} · ${item.source || "practice"} · ${detectorLabel(item.detector)}`));
    if (item.excerpt) block.append(el("p", "quote", item.excerpt));
    if (item.detail) block.append(el("p", null, item.detail));
    if (item.suggestion) block.append(el("p", "meta", `You can say: ${item.suggestion}`));
    card.append(block);
  }
  return card;
}

function lineBlock(student) {
  const card = el("section", "card section");
  card.append(el("h2", null, "English they typed"));
  const items = student.lines || [];
  if (!items.length) {
    card.append(el("p", "lede", "Nothing typed yet."));
    return card;
  }
  for (const item of items) {
    const block = el("article", "line");
    block.append(el("div", "meta", `${formatWhen(item.at)} · ${item.source}`));
    block.append(el("p", "quote", item.text));
    card.append(block);
  }
  return card;
}
