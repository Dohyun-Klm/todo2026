const STORAGE_KEY = "todo-calendar-items";
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const DOW_FULL = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

const state = {
  cursor: stripTime(new Date()),
  selected: dateKey(new Date()),
  view: "month",
  todos: [],
  editingId: null,
  confirmDeleteId: null,
  focus: null,
  scrollDetail: false,
};

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dowName(date) {
  return date.getDay() === 0 ? "sun" : date.getDay() === 6 ? "sat" : "";
}

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function normalize(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

function isTodo(item) {
  return Boolean(
    item &&
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      typeof item.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.date)
  );
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const items = Array.isArray(raw) ? raw : raw?.items;
    if (!Array.isArray(items)) return [];
    return items.filter(isTodo).map((item) => ({
      id: item.id,
      date: item.date,
      title: normalize(item.title),
      done: Boolean(item.done),
      createdAt: Number(item.createdAt) || 0,
    }));
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, items: state.todos })
  );
}

function sorted(list) {
  return [...list].sort(
    (a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt
  );
}

function todosOn(key) {
  return sorted(state.todos.filter((todo) => todo.date === key));
}

function monthDays(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
  );
}

function weekDays(anchor) {
  const start = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate() - anchor.getDay()
  );
  return Array.from({ length: 7 }, (_, index) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
  );
}

function periodTodos() {
  if (state.view === "day") return todosOn(dateKey(state.cursor));
  if (state.view === "week") {
    const keys = new Set(weekDays(state.cursor).map(dateKey));
    return state.todos.filter((todo) => keys.has(todo.date));
  }
  return state.todos.filter((todo) => {
    const date = parseKey(todo.date);
    return (
      date.getFullYear() === state.cursor.getFullYear() &&
      date.getMonth() === state.cursor.getMonth()
    );
  });
}

function rangeLabel() {
  const cursor = state.cursor;
  if (state.view === "month") {
    return `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;
  }
  if (state.view === "day") {
    return `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월 ${cursor.getDate()}일`;
  }
  const days = weekDays(cursor);
  const start = days[0];
  const end = days[6];
  if (start.getFullYear() !== end.getFullYear()) {
    return `${formatKorean(start)} – ${formatKorean(end)}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 – ${end.getMonth() + 1}월 ${end.getDate()}일`;
  }
  return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 – ${end.getDate()}일`;
}

function formatKorean(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatHeading(key) {
  const date = parseKey(key);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${DOW[date.getDay()]})`;
}

function summaryText(list) {
  if (list.length === 0) return "등록된 할 일이 없습니다";
  const left = list.filter((todo) => !todo.done).length;
  return `${list.length}개 중 ${left}개 남음`;
}

function renderMonth() {
  const days = monthDays(state.cursor);
  const month = state.cursor.getMonth();
  const cells = days
    .map((date) => {
      const key = dateKey(date);
      const items = todosOn(key);
      const shown = items.slice(0, 3);
      const extra = items.length - shown.length;
      const classes = [
        "cell",
        date.getMonth() === month ? "" : "is-out",
        key === state.selected ? "is-selected" : "",
        key === dateKey(new Date()) ? "is-today" : "",
        items.length ? "has-items" : "",
        items.length && items.every((todo) => todo.done) ? "all-done" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const pills = shown
        .map(
          (todo) =>
            `<span class="pill${todo.done ? " done" : ""}">${esc(todo.title)}</span>`
        )
        .join("");
      const more = extra > 0 ? `<span class="more">+${extra}</span>` : "";
      return `<button type="button" class="${classes}" data-date="${key}" ${
        key === dateKey(new Date()) ? 'aria-current="date"' : ""
      } aria-pressed="${key === state.selected}">
        <span class="num ${dowName(date)}">${date.getDate()}</span>
        ${pills}
        ${more}
        <span class="count-dot" aria-hidden="true"></span>
      </button>`;
    })
    .join("");

  const heads = DOW.map(
    (name, index) =>
      `<span class="${index === 0 ? "sun" : index === 6 ? "sat" : ""}">${name}</span>`
  ).join("");

  return `<div class="sheet">
    <div class="dows">${heads}</div>
    <div class="days">${cells}</div>
  </div>`;
}

function renderWeek() {
  const today = dateKey(new Date());
  const columns = weekDays(state.cursor)
    .map((date) => {
      const key = dateKey(date);
      const items = todosOn(key);
      const classes = [
        "week-col",
        key === state.selected ? "is-selected" : "",
        key === today ? "is-today" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const cards = items.length
        ? items
            .map(
              (todo) => `<button type="button" class="week-card${
                todo.done ? " done" : ""
              }" data-action="edit" data-id="${esc(todo.id)}" data-date="${key}">
            <span class="dot" aria-hidden="true"></span>
            <span class="week-card-title">${esc(todo.title)}</span>
          </button>`
            )
            .join("")
        : `<p class="week-empty">없음</p>`;
      return `<div class="${classes}" data-date="${key}">
        <button type="button" class="week-head" data-date="${key}" ${
          key === today ? 'aria-current="date"' : ""
        }>
          <span class="week-dow ${dowName(date)}">${DOW[date.getDay()]}</span>
          <span class="num ${dowName(date)}">${date.getDate()}</span>
        </button>
        ${cards}
        <button type="button" class="week-add" data-date="${key}" data-focus-add="1">+ 추가</button>
      </div>`;
    })
    .join("");
  return `<div class="sheet"><div class="week">${columns}</div></div>`;
}

function renderEditor(key) {
  const items = todosOn(key);
  const rows = items.map(renderTodo).join("");
  const body = items.length
    ? `<ul class="todo-list">${rows}</ul>`
    : `<p class="empty">이 날짜의 할 일이 없습니다.<br>위에 새로 추가해 보세요.</p>`;
  return `<div class="editor">
    <h2>${formatHeading(key)}</h2>
    <p class="summary" aria-live="polite">${summaryText(items)}</p>
    <form id="add-form" class="add-form">
      <input id="todo-input" type="text" maxlength="200" placeholder="할 일을 입력하세요" aria-label="새 할 일" autocomplete="off" required>
      <button type="submit">추가</button>
    </form>
    ${body}
    <p class="hint">이 브라우저의 로컬스토리지에 저장됩니다.</p>
  </div>`;
}

function renderTodo(todo) {
  if (state.confirmDeleteId === todo.id) {
    return `<li class="todo" data-id="${esc(todo.id)}">
      <div class="confirm">
        <span>이 할 일을 삭제할까요?</span>
        <button type="button" data-action="confirm-delete">삭제</button>
        <button type="button" class="ghost" data-action="cancel">취소</button>
      </div>
    </li>`;
  }
  if (state.editingId === todo.id) {
    return `<li class="todo" data-id="${esc(todo.id)}">
      <form class="edit-form" data-id="${esc(todo.id)}">
        <input type="date" value="${todo.date}" aria-label="날짜" required>
        <input type="text" maxlength="200" value="${esc(todo.title)}" aria-label="할 일 내용" required>
        <button type="submit">저장</button>
        <button type="button" class="ghost" data-action="cancel">취소</button>
      </form>
    </li>`;
  }
  return `<li class="todo${todo.done ? " done" : ""}" data-id="${esc(todo.id)}">
    <button type="button" class="check" data-action="toggle" aria-label="${
      todo.done ? "완료 해제" : "완료"
    }" aria-pressed="${todo.done}"></button>
    <span class="title">${esc(todo.title)}</span>
    <span class="row-actions">
      <button type="button" class="text-btn" data-action="edit">수정</button>
      <button type="button" class="text-btn danger" data-action="delete">삭제</button>
    </span>
  </li>`;
}

function renderDay() {
  const date = state.cursor;
  const tone = dowName(date);
  return `<div class="day-layout">
    <div>
      <p class="day-kicker ${tone}">${DOW_FULL[date.getDay()]}</p>
      <p class="big-num">${date.getDate()}</p>
      <p class="range-meta">${date.getFullYear()}년 ${date.getMonth() + 1}월</p>
    </div>
    ${renderEditor(dateKey(date))}
  </div>`;
}

function render() {
  const items = periodTodos();
  const done = items.filter((todo) => todo.done).length;
  document.getElementById("range-label").textContent = rangeLabel();
  document.getElementById("range-meta").textContent = items.length
    ? `할 일 ${items.length}개 · 완료 ${done}개`
    : "할 일 없음";
  document.title = `할 일 · ${rangeLabel()}`;

  const labels = {
    month: ["이전 달", "다음 달"],
    week: ["이전 주", "다음 주"],
    day: ["이전 날", "다음 날"],
  };
  document.getElementById("prev").setAttribute("aria-label", labels[state.view][0]);
  document.getElementById("next").setAttribute("aria-label", labels[state.view][1]);

  for (const view of ["day", "week", "month"]) {
    document.getElementById(`tab-${view}`).setAttribute(
      "aria-selected",
      String(state.view === view)
    );
  }

  const main = document.getElementById("main");
  const board = document.getElementById("board");
  const detail = document.getElementById("detail");
  main.classList.toggle("mode-day", state.view === "day");

  if (state.view === "day") {
    board.setAttribute("aria-label", "일별 할 일");
    board.innerHTML = renderDay();
    detail.innerHTML = "";
    detail.hidden = true;
  } else {
    board.setAttribute("aria-label", state.view === "week" ? "주별 달력" : "월별 달력");
    board.innerHTML = state.view === "week" ? renderWeek() : renderMonth();
    detail.hidden = false;
    detail.innerHTML = `<div class="detail-card">${renderEditor(state.selected)}</div>`;
  }

  if (state.focus === "edit") {
    document.querySelector(".edit-form input[type='text']")?.focus();
  } else if (state.focus === "add") {
    document.getElementById("todo-input")?.focus();
  }
  state.focus = null;

  if (state.scrollDetail) {
    state.scrollDetail = false;
    if (window.matchMedia("(max-width: 900px)").matches && state.view !== "day") {
      document.getElementById("detail")?.scrollIntoView({ block: "nearest" });
    }
  }
}

function selectDate(key, options = {}) {
  state.selected = key;
  state.editingId = null;
  state.confirmDeleteId = null;
  const date = parseKey(key);
  if (state.view === "month") {
    if (
      date.getFullYear() !== state.cursor.getFullYear() ||
      date.getMonth() !== state.cursor.getMonth()
    ) {
      state.cursor = new Date(date.getFullYear(), date.getMonth(), 1);
    }
  } else {
    state.cursor = date;
  }
  state.focus = options.focus || null;
  state.scrollDetail = true;
  render();
}

function setView(view) {
  if (!["day", "week", "month"].includes(view)) return;
  state.view = view;
  const selected = parseKey(state.selected);
  state.cursor =
    view === "month"
      ? new Date(selected.getFullYear(), selected.getMonth(), 1)
      : selected;
  state.editingId = null;
  state.confirmDeleteId = null;
  render();
}

function shift(direction) {
  const cursor = state.cursor;
  if (state.view === "month") {
    const selected = parseKey(state.selected);
    const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1);
    const lastDay = new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth() + 1,
      0
    ).getDate();
    state.cursor = nextMonth;
    state.selected = dateKey(
      new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(selected.getDate(), lastDay))
    );
  } else if (state.view === "week") {
    state.cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 7 * direction
    );
    state.selected = dateKey(state.cursor);
  } else {
    state.cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + direction
    );
    state.selected = dateKey(state.cursor);
  }
  state.editingId = null;
  state.confirmDeleteId = null;
  render();
}

function goToday() {
  const today = stripTime(new Date());
  state.cursor = state.view === "month"
    ? new Date(today.getFullYear(), today.getMonth(), 1)
    : today;
  state.selected = dateKey(today);
  state.editingId = null;
  state.confirmDeleteId = null;
  render();
}

function onClick(event) {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    setView(viewButton.dataset.view);
    return;
  }
  if (event.target.closest("[data-today]")) {
    goToday();
    return;
  }
  const shiftButton = event.target.closest("[data-shift]");
  if (shiftButton) {
    shift(Number(shiftButton.dataset.shift));
    return;
  }
  const focusAdd = event.target.closest("[data-focus-add]");
  if (focusAdd) {
    selectDate(focusAdd.dataset.date, { focus: "add" });
    return;
  }
  const actionEl = event.target.closest("[data-action]");
  if (actionEl) {
    handleAction(actionEl);
    return;
  }
  const dateEl = event.target.closest("[data-date]");
  if (dateEl) selectDate(dateEl.dataset.date);
}

function handleAction(element) {
  const action = element.dataset.action;
  if (action === "cancel") {
    state.editingId = null;
    state.confirmDeleteId = null;
    render();
    return;
  }
  const id = element.closest("[data-id]")?.dataset.id;
  const todo = state.todos.find((item) => item.id === id);
  if (!todo) return;

  if (action === "toggle") {
    todo.done = !todo.done;
    save();
    render();
    return;
  }
  if (action === "edit") {
    state.editingId = todo.id;
    state.confirmDeleteId = null;
    state.selected = todo.date;
    if (state.view !== "month") state.cursor = parseKey(todo.date);
    state.focus = "edit";
    render();
    return;
  }
  if (action === "delete") {
    state.confirmDeleteId = todo.id;
    state.editingId = null;
    render();
    return;
  }
  if (action === "confirm-delete") {
    state.todos = state.todos.filter((item) => item.id !== todo.id);
    state.confirmDeleteId = null;
    state.editingId = null;
    save();
    render();
  }
}

function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.id === "add-form") {
    event.preventDefault();
    const input = form.querySelector("input");
    const title = normalize(input.value);
    if (!title) {
      input.value = "";
      return;
    }
    state.todos.push({
      id: uid(),
      date: state.view === "day" ? dateKey(state.cursor) : state.selected,
      title,
      done: false,
      createdAt: Date.now(),
    });
    save();
    state.focus = "add";
    render();
    return;
  }

  if (form.classList.contains("edit-form")) {
    event.preventDefault();
    const todo = state.todos.find((item) => item.id === form.dataset.id);
    if (!todo) return;
    const title = normalize(form.querySelector('input[type="text"]').value);
    const date = form.querySelector('input[type="date"]').value;
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    todo.title = title;
    todo.date = date;
    state.editingId = null;
    save();
    render();
  }
}

function onKeydown(event) {
  if (event.key === "Escape" && (state.editingId || state.confirmDeleteId)) {
    state.editingId = null;
    state.confirmDeleteId = null;
    render();
    return;
  }
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    shift(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    shift(1);
  }
}

function init() {
  state.todos = load();
  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      state.todos = load();
      render();
    }
  });
  render();
}

init();
