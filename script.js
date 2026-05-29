let state = null;
let currentUser = JSON.parse(localStorage.getItem("classbridge-user") || "null");

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed");
  if (payload.state) state = payload.state;
  return payload;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function setDefaultDateTimes() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset() + 60);
  const value = now.toISOString().slice(0, 16);
  $("#classTime").value = value;
  $("#testTime").value = value;
  $("#assignmentDue").value = value;
}

function toast(message, type = "info") {
  const note = document.createElement("div");
  note.className = "toast";
  note.textContent = message;
  if (type === "danger") note.style.borderLeftColor = "var(--coral)";
  if (type === "payment") note.style.borderLeftColor = "var(--amber)";
  $("#toastStack").append(note);
  window.setTimeout(() => note.remove(), 4200);
}

function formatDateTime(value) {
  if (!value) return "Time not set";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short"
  }).format(new Date(value));
}

function userId() {
  return currentUser?.id || "student-1";
}

function teacherId() {
  return currentUser?.role === "teacher" ? currentUser.id : "teacher-1";
}

function isTeacher() {
  return currentUser?.role === "teacher";
}

function isStudent() {
  return currentUser?.role === "student";
}

function requireUiRole(role) {
  if (role === "teacher" && !isTeacher()) {
    toast("Sign in as teacher to use this action.", "danger");
    return false;
  }
  if (role === "student" && !isStudent()) {
    toast("Sign in as student to use this action.", "danger");
    return false;
  }
  return true;
}

function roleLabel() {
  if (!currentUser) return "<strong>Guest</strong> choose login";
  const role = currentUser.role === "teacher" ? "Teacher" : "Student";
  return `<strong>${role}</strong> signed in`;
}

function requestForTest(testId) {
  return state.testRequests.find((item) => item.testId === testId && item.studentId === userId());
}

function submissionForAssignment(assignmentId) {
  return state.assignmentSubmissions.find((item) => item.assignmentId === assignmentId && item.studentId === userId());
}

function renderShell() {
  $("#currentUserLabel").innerHTML = roleLabel();
  document.body.dataset.role = currentUser?.role || "guest";
  $$("[data-teacher-action]").forEach((item) => {
    item.disabled = !isTeacher();
  });
  $$("[data-student-action]").forEach((item) => {
    item.disabled = !isStudent();
  });
}

function renderClasses() {
  $("#classList").innerHTML = state.classes.map((item) => `
    <article class="item">
      <div class="item-header">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.time)} by ${escapeHtml(item.teacherName)}</small>
        </div>
        <span class="status-pill">Scheduled</span>
      </div>
      <small>${escapeHtml(item.link)}</small>
    </article>
  `).join("");

  const firstClass = state.classes[0];
  if (firstClass) $("#shareLink").textContent = firstClass.link;
}

function renderJoinRequests() {
  const waiting = state.classRequests.filter((item) => item.status === "waiting");
  $("#pendingJoins").textContent = waiting.length;
  $("#joinRequests").innerHTML = state.classRequests.map((item) => `
    <article class="item">
      <div class="item-header">
        <div>
          <strong>${escapeHtml(item.studentName)}</strong>
          <small>${escapeHtml(item.className)}</small>
        </div>
        <span class="status-pill">${escapeHtml(item.status)}</span>
      </div>
      <div class="item-actions">
        <button class="primary-btn" data-teacher-action data-admit="${item.id}">Admit</button>
        <button class="secondary-btn" data-teacher-action data-decline="${item.id}">Decline</button>
      </div>
    </article>
  `).join("") || `<article class="item"><strong>No meeting requests yet.</strong></article>`;
}

function renderTests() {
  $("#testList").innerHTML = state.tests.map((item) => `
    <article class="item">
      <div class="item-header">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.time)} - Rs ${item.fee}</small>
        </div>
        <span class="status-pill accent">${escapeHtml(item.status)}</span>
      </div>
      <small>${escapeHtml(item.question)}</small>
    </article>
  `).join("");

  $("#studentTests").innerHTML = state.tests.map((item) => {
    const request = requestForTest(item.id);
    const requestText = request
      ? `Payment: ${request.paymentStatus}. Permission: ${request.permissionStatus}.`
      : "Request admission, pay the fee, then wait for permission.";
    const canEnter = request?.permissionStatus === "permitted";
    return `
      <article class="item">
        <div class="item-header">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${escapeHtml(item.time)} - Pay Rs ${item.fee} to teacher</small>
          </div>
          <span class="status-pill accent">${escapeHtml(item.status)}</span>
        </div>
        <small>${escapeHtml(requestText)}</small>
        <div class="item-actions">
          <button class="primary-btn" data-student-action data-test-request="${item.id}">Request admit</button>
          <button class="secondary-btn" data-student-action data-pay-test="${item.id}">Pay fee</button>
          <button class="danger-btn" data-enter-exam="${item.id}" ${canEnter ? "" : "disabled"}>Enter exam</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderPayments() {
  const paid = state.testRequests.filter((item) => item.paymentStatus !== "pending").length;
  $("#paidAdmits").textContent = paid;
  $("#paymentRequests").innerHTML = state.testRequests.map((item) => `
    <article class="item">
      <div class="item-header">
        <div>
          <strong>${escapeHtml(item.studentName)}</strong>
          <small>${escapeHtml(item.testName)} - Rs ${item.amount}</small>
        </div>
        <span class="status-pill">${escapeHtml(item.paymentStatus)} / ${escapeHtml(item.permissionStatus)}</span>
      </div>
      <div class="item-actions">
        <button class="primary-btn" data-teacher-action data-confirm-payment="${item.id}">Confirm payment</button>
        <button class="secondary-btn" data-teacher-action data-permit-test="${item.id}">Permit test</button>
      </div>
    </article>
  `).join("") || `<article class="item"><strong>No paid test requests yet.</strong></article>`;
}

function renderAssignments() {
  $("#assignmentList").innerHTML = state.assignments.map((item) => `
    <article class="item">
      <div class="item-header">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <small>Due ${escapeHtml(item.dueDate)} by ${escapeHtml(item.teacherName)}</small>
        </div>
        <span class="status-pill">Homework</span>
      </div>
      <small>${escapeHtml(item.instructions)}</small>
    </article>
  `).join("") || `<article class="item"><strong>No assignments yet.</strong></article>`;

  $("#studentAssignments").innerHTML = state.assignments.map((item) => {
    const submission = submissionForAssignment(item.id);
    return `
      <article class="item">
        <div class="item-header">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <small>Due ${escapeHtml(item.dueDate)}</small>
          </div>
          <span class="status-pill">${submission ? escapeHtml(submission.status) : "pending"}</span>
        </div>
        <small>${escapeHtml(item.instructions)}</small>
        <label>
          Homework answer
          <textarea data-assignment-answer="${item.id}" placeholder="Write your homework answer here">${escapeHtml(submission?.answer || "")}</textarea>
        </label>
        <div class="item-actions">
          <button class="primary-btn" data-student-action data-submit-assignment="${item.id}">Submit homework</button>
        </div>
      </article>
    `;
  }).join("") || `<article class="item"><strong>No assignments yet.</strong></article>`;
}

function renderSubmissions() {
  $("#submissionList").innerHTML = state.assignmentSubmissions.map((item) => `
    <article class="item">
      <div class="item-header">
        <div>
          <strong>${escapeHtml(item.studentName)}</strong>
          <small>${escapeHtml(item.assignmentTitle)} - ${escapeHtml(item.status)}</small>
        </div>
        <span class="status-pill accent">${escapeHtml(item.status)}</span>
      </div>
      <small>${escapeHtml(item.answer || "No answer text.")}</small>
      <label>
        Feedback
        <textarea data-feedback="${item.id}" placeholder="Write teacher feedback">${escapeHtml(item.feedback || "")}</textarea>
      </label>
      <div class="item-actions">
        <button class="primary-btn" data-teacher-action data-review-submission="${item.id}">Mark reviewed</button>
      </div>
    </article>
  `).join("") || `<article class="item"><strong>No homework submissions yet.</strong></article>`;

  $("#studentSubmissions").innerHTML = state.assignmentSubmissions
    .filter((item) => item.studentId === userId())
    .map((item) => `
      <article class="item">
        <div class="item-header">
          <div>
            <strong>${escapeHtml(item.assignmentTitle)}</strong>
            <small>${escapeHtml(item.status)}</small>
          </div>
          <span class="status-pill">${escapeHtml(item.status)}</span>
        </div>
        <small>${escapeHtml(item.feedback || "Waiting for teacher review.")}</small>
      </article>
    `).join("") || `<article class="item"><strong>No submissions yet.</strong></article>`;
}

function renderNotifications() {
  $("#notifications").innerHTML = state.notifications.map((item) => `
    <article class="item">
      <strong>${escapeHtml(item.message)}</strong>
      <small>${new Date(item.createdAt).toLocaleString()}</small>
    </article>
  `).join("") || `<article class="item"><strong>No notifications yet.</strong></article>`;
}

function renderExamFlags() {
  $("#focusFlags").textContent = state.examFlags.length;
  const target = $("#examFlags");
  if (!target) return;
  target.innerHTML = state.examFlags.slice(0, 5).map((item) => `
    <article class="item">
      <strong>${escapeHtml(item.studentName)}: ${escapeHtml(item.reason)}</strong>
      <small>${new Date(item.createdAt).toLocaleString()}</small>
    </article>
  `).join("") || `<article class="item"><strong>No exam warnings recorded.</strong></article>`;
}

function renderAll() {
  if (!state) return;
  renderShell();
  renderClasses();
  renderJoinRequests();
  renderTests();
  renderPayments();
  renderAssignments();
  renderSubmissions();
  renderNotifications();
  renderExamFlags();
}

async function refresh() {
  const query = currentUser ? `?userId=${encodeURIComponent(currentUser.id)}` : "";
  state = await api(`/api/state${query}`);
  if (!currentUser) {
    currentUser = state.currentUser;
    localStorage.setItem("classbridge-user", JSON.stringify(currentUser));
  }
  renderAll();
}

async function runAction(work, success, type = "info") {
  try {
    await work();
    renderAll();
    if (success) toast(success, type);
  } catch (error) {
    toast(error.message, "danger");
  }
}

async function addExamFlag(reason) {
  await api("/api/exam/flags", {
    method: "POST",
    body: { studentId: userId(), reason }
  });
  renderAll();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const target = button.dataset.scroll;
  if (target) document.querySelector(target)?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (button.id === "loginBtn") {
    runAction(async () => {
      const role = $("#loginRole").value;
      const payload = await api("/api/login", {
        method: "POST",
        body: { name: role === "teacher" ? "Demo Sir" : "Demo Student", role }
      });
      currentUser = payload.user;
      localStorage.setItem("classbridge-user", JSON.stringify(currentUser));
    }, "Signed in. Your dashboard is connected to the backend.");
  }

  if (button.id === "copyLinkBtn") {
    navigator.clipboard?.writeText($("#shareLink").textContent);
    toast("Meeting link copied. Students can request admission through this link.");
  }

  if (button.id === "studentJoinBtn") {
    if (!requireUiRole("student")) return;
    runAction(async () => {
      const firstClass = state.classes[0];
      if (!firstClass) throw new Error("No class is scheduled yet.");
      await api(`/api/classes/${firstClass.id}/join`, {
        method: "POST",
        body: { studentId: userId() }
      });
    }, "Join request saved in the backend. Teacher must admit the student before entry.");
  }

  if (button.id === "publishTestBtn") {
    toast("Use Add test. Students receive a backend notification automatically.");
  }

  if (button.id === "startExamBtn") {
    $("#examShell").classList.add("locked");
    $("#examShell .status-pill").textContent = "Locked mode active";
    toast("Secure exam demo started. Screenshot shortcuts and tab switching are being monitored.", "danger");
  }

  if (button.dataset.admit) {
    if (!requireUiRole("teacher")) return;
    runAction(() => api(`/api/class-requests/${button.dataset.admit}`, {
      method: "PATCH",
      body: { teacherId: teacherId(), status: "admitted" }
    }), "Student admitted into the meeting.");
  }

  if (button.dataset.decline) {
    if (!requireUiRole("teacher")) return;
    runAction(() => api(`/api/class-requests/${button.dataset.decline}`, {
      method: "PATCH",
      body: { teacherId: teacherId(), status: "declined" }
    }), "Join request declined.");
  }

  if (button.dataset.testRequest) {
    if (!requireUiRole("student")) return;
    runAction(() => api(`/api/tests/${button.dataset.testRequest}/request`, {
      method: "POST",
      body: { studentId: userId() }
    }), "Test admit request saved. Payment is required before permission.", "payment");
  }

  if (button.dataset.payTest) {
    if (!requireUiRole("student")) return;
    const request = requestForTest(button.dataset.payTest);
    if (!request) {
      toast("Request admission before paying for this test.", "danger");
      return;
    }
    runAction(() => api(`/api/test-requests/${request.id}/pay`, {
      method: "PATCH",
      body: { userId: userId() }
    }), "Payment sent to teacher. Waiting for approval.", "payment");
  }

  if (button.dataset.confirmPayment) {
    if (!requireUiRole("teacher")) return;
    runAction(() => api(`/api/test-requests/${button.dataset.confirmPayment}/confirm-payment`, {
      method: "PATCH",
      body: { userId: teacherId() }
    }), "Payment confirmed. Teacher can now permit the test.", "payment");
  }

  if (button.dataset.permitTest) {
    if (!requireUiRole("teacher")) return;
    runAction(() => api(`/api/test-requests/${button.dataset.permitTest}/permit`, {
      method: "PATCH",
      body: { userId: teacherId() }
    }), "Student permitted for the exam.");
  }

  if (button.dataset.enterExam) {
    if (!requireUiRole("student")) return;
    const request = requestForTest(button.dataset.enterExam);
    if (request?.permissionStatus !== "permitted") {
      toast("Teacher permission is required before entering the exam.", "danger");
      return;
    }
    $("#examShell").classList.add("locked");
    $("#examShell .status-pill").textContent = "Locked mode active";
    $("#examQuestion").textContent = state.tests.find((item) => item.id === button.dataset.enterExam)?.question || "Write your answer.";
    document.querySelector("#exam").scrollIntoView({ behavior: "smooth" });
  }

  if (button.dataset.submitAssignment) {
    if (!requireUiRole("student")) return;
    const answer = document.querySelector(`[data-assignment-answer="${button.dataset.submitAssignment}"]`)?.value;
    runAction(() => api(`/api/assignments/${button.dataset.submitAssignment}/submit`, {
      method: "POST",
      body: { studentId: userId(), answer }
    }), "Homework submitted to teacher.");
  }

  if (button.dataset.reviewSubmission) {
    if (!requireUiRole("teacher")) return;
    const feedback = document.querySelector(`[data-feedback="${button.dataset.reviewSubmission}"]`)?.value;
    runAction(() => api(`/api/assignment-submissions/${button.dataset.reviewSubmission}/review`, {
      method: "PATCH",
      body: { teacherId: teacherId(), feedback }
    }), "Homework marked as reviewed.");
  }
});

$("#addClassBtn").addEventListener("click", () => {
  if (!requireUiRole("teacher")) return;
  runAction(() => api("/api/classes", {
    method: "POST",
    body: {
      teacherId: teacherId(),
      title: $("#classTitle").value,
      time: formatDateTime($("#classTime").value),
      link: $("#meetingLink").value
    }
  }), "Class schedule saved to backend and students notified.");
});

$("#testForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!requireUiRole("teacher")) return;
  runAction(() => api("/api/tests", {
    method: "POST",
    body: {
      teacherId: teacherId(),
      name: $("#testName").value,
      fee: Number($("#testFee").value || 0),
      time: formatDateTime($("#testTime").value),
      question: $("#testQuestion").value
    }
  }), "Test saved to backend and notification sent.", "payment");
});

$("#assignmentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!requireUiRole("teacher")) return;
  runAction(() => api("/api/assignments", {
    method: "POST",
    body: {
      teacherId: teacherId(),
      title: $("#assignmentTitle").value,
      dueDate: formatDateTime($("#assignmentDue").value),
      instructions: $("#assignmentInstructions").value
    }
  }), "Homework assigned and students notified.");
});

$$(".nav-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    $$(".nav-chip").forEach((item) => item.classList.remove("active"));
    chip.classList.add("active");
    const selected = chip.dataset.panel;
    let firstVisiblePanel = null;
    $$("[data-panel-section]").forEach((panel) => {
      const shouldShow = panel.dataset.panelSection.includes(selected);
      panel.classList.toggle("hidden", !shouldShow);
      if (shouldShow && !firstVisiblePanel) firstVisiblePanel = panel;
    });
    const scrollTarget = selected === "overview" ? $("#teacher") : firstVisiblePanel;
    scrollTarget?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const blocked = key === "printscreen" || ((event.ctrlKey || event.metaKey) && event.shiftKey && ["s", "3", "4", "5"].includes(key));
  if (!blocked || !$("#examShell").classList.contains("locked")) return;
  event.preventDefault();
  addExamFlag("Screenshot shortcut blocked").catch(() => toast("Could not save exam flag.", "danger"));
  toast("Screenshot shortcut blocked and reported to teacher.", "danger");
});

window.addEventListener("blur", () => {
  if (!$("#examShell").classList.contains("locked")) return;
  addExamFlag("Focus left exam window").catch(() => toast("Could not save exam flag.", "danger"));
  toast("Focus left exam window. Teacher flag recorded.", "danger");
});

setDefaultDateTimes();
refresh().catch((error) => toast(error.message, "danger"));
