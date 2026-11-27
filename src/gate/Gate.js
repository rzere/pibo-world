import { CHARACTERS } from "../data/characters.js";

/**
 * The front door. Teachers and students each sign in, then go to their place.
 * Students pick a character here, then the island opens in their class world.
 */
export function openGate() {
  const card = document.getElementById("gate-card");
  return new Promise((resolve) => {
    const gate = new Gate(card, resolve);
    gate.start();
  });
}

class Gate {
  constructor(card, resolve) {
    this.card = card;
    this.resolve = resolve;
    this.session = null;
    this.char = "pibo";
    this.busy = false;
  }

  async start() {
    try {
      const res = await fetch("/api/auth", { credentials: "include" });
      this.session = res.ok ? await res.json() : null;
    } catch {
      this.session = null;
    }
    const params = new URLSearchParams(location.search);
    if (params.get("as") === "teacher") this.teacherSignin();
    else if (params.get("code")) this.studentSignup(params.get("code"));
    else this.bindHome();
    document.documentElement.classList.remove("gate-jump");
  }

  bindHome() {
    document.getElementById("gate-teacher")?.addEventListener("click", () => this.teacherSignin());
    document.getElementById("gate-student")?.addEventListener("click", () => this.studentSignin());
  }

  home() {
    this.card.innerHTML = `
      <img class="gate-pot" src="assets/pibo/pibo-thumb.png" alt="" />
      <p class="gate-kicker">Pibo World</p>
      <h1>Welcome to the island</h1>
      <p class="gate-copy">A small world for practicing English. Teachers and students each have their own door.</p>
      <div class="gate-choices">
        <button type="button" id="gate-teacher" class="gate-choice">I am a teacher</button>
        <button type="button" id="gate-student" class="gate-choice gate-choice-student">I am a student</button>
      </div>`;
    this.bindHome();
  }

  teacherSignin() {
    if (this.session?.role === "teacher") {
      this.card.innerHTML = `
        <img class="gate-pot" src="assets/pibo/pibo-thumb.png" alt="" />
        <p class="gate-kicker">Teacher</p>
        <h1>Hello, ${escapeHtml(this.session.name || this.session.username)}</h1>
        <p class="gate-copy">Your class worlds are ready.</p>
        <button type="button" class="gate-go" id="gate-continue">Go to my classes</button>
        <div class="gate-links">
          <button type="button" class="gate-link" id="gate-back">Back</button>
          <button type="button" class="gate-link" id="gate-other">Use another account</button>
        </div>`;
      this.card.querySelector("#gate-continue").addEventListener("click", () => {
        location.href = "/teacher/";
      });
      this.card.querySelector("#gate-back").addEventListener("click", () => this.home());
      this.card.querySelector("#gate-other").addEventListener("click", () => this.signOut(() => this.teacherSignin()));
      return;
    }
    this.form({
      kicker: "Teacher",
      title: "Teacher sign in",
      copy: "Use the username and password you created for your classes.",
      fields: [
        input("username", "Username", "text", "username"),
        input("password", "Password", "password", "current-password"),
      ],
      submit: "Sign in",
      links: [
        ["Back", () => this.home()],
        ["Create a teacher account", () => this.teacherSignup()],
      ],
      onSubmit: async (values, setError) => {
        const data = await postAuth({
          action: "teacher-signin",
          username: values.username,
          password: values.password,
        });
        if (data.error) {
          setError(data.error);
          return;
        }
        location.href = "/teacher/";
      },
    });
  }

  teacherSignup() {
    this.form({
      kicker: "Teacher",
      title: "Create a teacher account",
      copy: "No email. Pick a username and a password you can remember.",
      fields: [
        input("name", "Your name", "text", "name", "Ms. Lee"),
        input("username", "Username", "text", "username"),
        input("password", "Password", "password", "new-password"),
      ],
      submit: "Create account",
      links: [
        ["Back", () => this.teacherSignin()],
        ["I already have an account", () => this.teacherSignin()],
      ],
      onSubmit: async (values, setError) => {
        const data = await postAuth({
          action: "teacher-signup",
          name: values.name,
          username: values.username,
          password: values.password,
        });
        if (data.error) {
          setError(data.error);
          return;
        }
        location.href = "/teacher/";
      },
    });
  }

  studentSignin() {
    if (this.session?.role === "student" && this.session.world) {
      this.ready(this.session);
      return;
    }
    this.form({
      kicker: "Student",
      title: "Student sign in",
      copy: "Use the username and password from your class. No email.",
      fields: [
        input("username", "Username", "text", "username"),
        input("password", "Password", "password", "current-password"),
      ],
      submit: "Sign in",
      links: [
        ["Back", () => this.home()],
        ["I'm new — I have a class code", () => this.studentSignup("")],
      ],
      onSubmit: async (values, setError) => {
        const data = await postAuth({
          action: "student-signin",
          username: values.username,
          password: values.password,
        });
        if (data.error) {
          setError(data.error);
          return;
        }
        this.session = data;
        this.ready(data);
      },
    });
  }

  studentSignup(code) {
    this.form({
      kicker: "Student",
      title: "Join your class",
      copy: "Type the code from your teacher, then choose a username and password.",
      fields: [
        input("code", "Class code", "text", "off", "mint-garden", code || ""),
        input("nickname", "Name in the game", "text", "nickname", "Lina"),
        input("username", "Username", "text", "username"),
        input("password", "Password", "password", "new-password"),
      ],
      submit: "Join class",
      links: [
        ["Back", () => this.studentSignin()],
        ["I already have an account", () => this.studentSignin()],
      ],
      onReady: (root) => {
        const codeInput = root.querySelector("#code");
        const note = document.createElement("p");
        note.className = "gate-class";
        note.hidden = true;
        codeInput.insertAdjacentElement("afterend", note);
        const look = async () => {
          const value = codeInput.value.trim();
          if (!value) {
            note.hidden = true;
            return;
          }
          try {
            const res = await fetch(`/api/class?code=${encodeURIComponent(value)}`);
            const data = await res.json();
            if (!res.ok) {
              note.hidden = true;
              return;
            }
            note.hidden = false;
            note.textContent = data.level ? `${data.name} · ${data.level}` : data.name;
          } catch {
            note.hidden = true;
          }
        };
        codeInput.addEventListener("change", look);
        if (codeInput.value) look();
      },
      onSubmit: async (values, setError) => {
        const data = await postAuth({
          action: "student-signup",
          code: values.code,
          nickname: values.nickname,
          username: values.username,
          password: values.password,
        });
        if (data.error) {
          setError(data.error);
          return;
        }
        this.session = data;
        this.ready(data);
      },
    });
  }

  ready(session) {
    const world = session.world;
    if (!world) {
      this.studentSignin();
      return;
    }
    const buttons = CHARACTERS.map((character) => `
      <button type="button" class="gate-char${character.id === this.char ? " on" : ""}" data-char="${character.id}">
        <img src="${character.thumb}" alt="" />
        <span>${escapeHtml(character.label)}</span>
      </button>`).join("");
    this.card.innerHTML = `
      <img class="gate-pot" src="assets/pibo/pibo-thumb.png" alt="" />
      <p class="gate-kicker">Student</p>
      <h1>Hi, ${escapeHtml(session.nickname || session.username)}</h1>
      <p class="gate-copy">You are in ${escapeHtml(world.name)}. Pick who you want to be, then step onto the island.</p>
      <div class="gate-chars">${buttons}</div>
      <button type="button" class="gate-go" id="gate-play">Play</button>
      <div class="gate-links">
        <button type="button" class="gate-link" id="gate-back">Back</button>
        <button type="button" class="gate-link" id="gate-other">Not me</button>
      </div>
      <p class="gate-error" id="gate-error"></p>`;
    this.card.querySelectorAll("[data-char]").forEach((button) => {
      button.addEventListener("click", () => {
        this.char = button.getAttribute("data-char");
        this.card.querySelectorAll("[data-char]").forEach((item) => item.classList.toggle("on", item === button));
      });
    });
    this.card.querySelector("#gate-play").addEventListener("click", () => {
      this.card.querySelector("#gate-play").disabled = true;
      this.card.querySelector("#gate-play").textContent = "Opening the island…";
      this.resolve({
        role: "student",
        nickname: session.nickname || session.username,
        worldCode: world.code,
        worldTitle: world.name,
        pack: session.pack || null,
        char: this.char,
      });
    });
    this.card.querySelector("#gate-back").addEventListener("click", () => this.home());
    this.card.querySelector("#gate-other").addEventListener("click", () => this.signOut(() => this.studentSignin()));
  }

  async signOut(then) {
    try {
      await fetch("/api/auth", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "signout" }),
      });
    } catch {
      // still leave the screen
    }
    this.session = null;
    then();
  }

  form({ kicker, title, copy, fields, submit, links, onSubmit, onReady }) {
    this.card.innerHTML = `
      <img class="gate-pot" src="assets/pibo/pibo-thumb.png" alt="" />
      <p class="gate-kicker">${escapeHtml(kicker)}</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="gate-copy">${escapeHtml(copy)}</p>
      <form id="gate-form" novalidate>
        ${fields.join("")}
        <button type="submit" class="gate-go">${escapeHtml(submit)}</button>
      </form>
      <p class="gate-error" id="gate-error" role="alert"></p>
      <div class="gate-links">
        ${links.map((link, index) => `<button type="button" class="gate-link" data-link="${index}">${escapeHtml(link[0])}</button>`).join("")}
      </div>`;
    links.forEach((link, index) => {
      this.card.querySelector(`[data-link="${index}"]`).addEventListener("click", link[1]);
    });
    onReady?.(this.card);
    const form = this.card.querySelector("#gate-form");
    const error = this.card.querySelector("#gate-error");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (this.busy) return;
      this.busy = true;
      error.textContent = "";
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      const values = Object.fromEntries(new FormData(form).entries());
      try {
        await onSubmit(values, (message) => {
          error.textContent = message || "";
        });
      } catch {
        error.textContent = "We can't reach the island right now. Try again in a moment.";
      } finally {
        this.busy = false;
        if (button.isConnected) button.disabled = false;
      }
    });
    this.card.querySelector("input")?.focus();
  }
}

function input(name, label, type, auto, placeholder = "", value = "") {
  const val = value ? ` value="${escapeHtml(value)}"` : "";
  const hold = placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : "";
  return `<label class="gate-label" for="${name}">${escapeHtml(label)}</label>
    <input class="gate-input" id="${name}" name="${name}" type="${type}" autocomplete="${auto}"${hold}${val} />`;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function postAuth(body) {
  const res = await fetch("/api/auth", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "That did not work. Try again." };
  return data;
}
