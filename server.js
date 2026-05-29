const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const dataDir = path.join(root, "data");
const dbPath = path.join(dataDir, "db.json");
const port = Number(process.env.PORT || 5173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

const starterDb = {
  users: [
    { id: "teacher-1", role: "teacher", name: "Demo Sir" },
    { id: "student-1", role: "student", name: "Demo Student" }
  ],
  classes: [
    {
      id: "class-1",
      teacherId: "teacher-1",
      title: "Chemistry - Organic Basics",
      time: "Today, 7:00 PM",
      link: "https://meet.example.com/classbridge-101",
      createdAt: new Date().toISOString()
    },
    {
      id: "class-2",
      teacherId: "teacher-1",
      title: "Math - Trigonometry Doubts",
      time: "Tomorrow, 6:30 PM",
      link: "https://meet.example.com/classbridge-102",
      createdAt: new Date().toISOString()
    }
  ],
  classRequests: [
    {
      id: "join-1",
      classId: "class-1",
      studentId: "student-1",
      status: "waiting",
      createdAt: new Date().toISOString()
    }
  ],
  tests: [
    {
      id: "test-1",
      teacherId: "teacher-1",
      name: "Algebra Speed Test",
      fee: 99,
      time: "Today, 8:30 PM",
      question: "A train travels 120 km in 2 hours. What is its average speed?",
      status: "open",
      createdAt: new Date().toISOString()
    },
    {
      id: "test-2",
      teacherId: "teacher-1",
      name: "Physics MCQ Practice",
      fee: 149,
      time: "Saturday, 5:00 PM",
      question: "What is Newton's second law of motion?",
      status: "scheduled",
      createdAt: new Date().toISOString()
    }
  ],
  testRequests: [
    {
      id: "test-request-1",
      testId: "test-1",
      studentId: "student-1",
      paymentStatus: "paid",
      permissionStatus: "permitted",
      amount: 99,
      createdAt: new Date().toISOString()
    }
  ],
  assignments: [
    {
      id: "assignment-1",
      teacherId: "teacher-1",
      title: "Organic Chemistry Worksheet",
      dueDate: "Tomorrow, 9:00 PM",
      instructions: "Complete questions 1 to 10 from the worksheet and show all steps.",
      createdAt: new Date().toISOString()
    }
  ],
  assignmentSubmissions: [
    {
      id: "submission-1",
      assignmentId: "assignment-1",
      studentId: "student-1",
      answer: "I completed questions 1 to 10 and attached my working notes.",
      status: "submitted",
      feedback: "",
      createdAt: new Date().toISOString(),
      reviewedAt: ""
    }
  ],
  notifications: [
    {
      id: "note-1",
      userId: "student-1",
      message: "New test available: Algebra Speed Test. Request admit and complete payment.",
      createdAt: new Date().toISOString(),
      read: false
    },
    {
      id: "note-2",
      userId: "student-1",
      message: "Chemistry class starts Today at 7:00 PM. Join link opens after teacher approval.",
      createdAt: new Date().toISOString(),
      read: false
    }
  ],
  examFlags: []
};

function id(prefix) {
  return `${prefix}-${crypto.randomBytes(6).toString("hex")}`;
}

function ensureDb() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify(starterDb, null, 2));
}

function readDb() {
  ensureDb();
  const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  db.assignments ||= [];
  db.assignmentSubmissions ||= [];
  return db;
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function send(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) request.destroy();
    });
    request.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function publicState(db, userId) {
  const usersById = Object.fromEntries(db.users.map((user) => [user.id, user]));
  const classes = db.classes.map((item) => ({
    ...item,
    teacherName: usersById[item.teacherId]?.name || "Teacher"
  }));
  const tests = db.tests.map((item) => ({
    ...item,
    teacherName: usersById[item.teacherId]?.name || "Teacher"
  }));
  const assignments = db.assignments.map((item) => ({
    ...item,
    teacherName: usersById[item.teacherId]?.name || "Teacher"
  }));

  return {
    users: db.users,
    currentUser: db.users.find((user) => user.id === userId) || db.users[0],
    classes,
    classRequests: db.classRequests.map((item) => ({
      ...item,
      className: db.classes.find((course) => course.id === item.classId)?.title || "Class",
      studentName: usersById[item.studentId]?.name || "Student"
    })),
    tests,
    assignments,
    assignmentSubmissions: db.assignmentSubmissions.map((item) => ({
      ...item,
      assignmentTitle: db.assignments.find((assignment) => assignment.id === item.assignmentId)?.title || "Assignment",
      studentName: usersById[item.studentId]?.name || "Student"
    })),
    testRequests: db.testRequests.map((item) => ({
      ...item,
      testName: db.tests.find((test) => test.id === item.testId)?.name || "Test",
      studentName: usersById[item.studentId]?.name || "Student"
    })),
    notifications: db.notifications
      .filter((item) => !userId || item.userId === userId || item.userId === "all-students")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    examFlags: db.examFlags.map((item) => ({
      ...item,
      studentName: usersById[item.studentId]?.name || "Student"
    }))
  };
}

function notify(db, userId, message) {
  db.notifications.unshift({
    id: id("note"),
    userId,
    message,
    createdAt: new Date().toISOString(),
    read: false
  });
}

function findUser(db, userId) {
  return db.users.find((user) => user.id === userId);
}

function requireRole(db, userId, role) {
  const user = findUser(db, userId);
  if (!user || user.role !== role) {
    throw new Error(`${role === "teacher" ? "Teacher" : "Student"} account required`);
  }
  return user;
}

function routeParts(urlPath) {
  return urlPath.split("/").filter(Boolean);
}

async function handleApi(request, response, urlPath, searchParams) {
  const db = readDb();
  const parts = routeParts(urlPath);

  try {
    if (request.method === "GET" && urlPath === "/api/state") {
      return send(response, 200, publicState(db, searchParams.get("userId")));
    }

    if (request.method === "POST" && urlPath === "/api/login") {
      const body = await readBody(request);
      const role = body.role === "teacher" ? "teacher" : "student";
      const name = String(body.name || "").trim() || (role === "teacher" ? "Demo Sir" : "Demo Student");
      let user = db.users.find((item) => item.role === role && item.name.toLowerCase() === name.toLowerCase());
      if (!user) {
        user = { id: id(role), role, name };
        db.users.push(user);
        if (role === "student") notify(db, user.id, "Welcome. Request class entry or test permission from your dashboard.");
      }
      writeDb(db);
      return send(response, 200, { user, state: publicState(db, user.id) });
    }

    if (request.method === "POST" && urlPath === "/api/classes") {
      const body = await readBody(request);
      requireRole(db, body.teacherId || "teacher-1", "teacher");
      const item = {
        id: id("class"),
        teacherId: body.teacherId || "teacher-1",
        title: String(body.title || "Untitled class").trim(),
        time: String(body.time || "Time not set"),
        link: String(body.link || "No meeting link added"),
        createdAt: new Date().toISOString()
      };
      db.classes.unshift(item);
      notify(db, "all-students", `New class scheduled: ${item.title}. Request admission before joining.`);
      writeDb(db);
      return send(response, 201, { item, state: publicState(db, body.teacherId) });
    }

    if (request.method === "POST" && parts[0] === "api" && parts[1] === "classes" && parts[3] === "join") {
      const body = await readBody(request);
      const classId = parts[2];
      requireRole(db, body.studentId, "student");
      const existing = db.classRequests.find((item) => item.classId === classId && item.studentId === body.studentId);
      if (existing) return send(response, 200, { item: existing, state: publicState(db, body.studentId) });
      const item = {
        id: id("join"),
        classId,
        studentId: body.studentId,
        status: "waiting",
        createdAt: new Date().toISOString()
      };
      db.classRequests.unshift(item);
      writeDb(db);
      return send(response, 201, { item, state: publicState(db, body.studentId) });
    }

    if (request.method === "PATCH" && parts[0] === "api" && parts[1] === "class-requests") {
      const body = await readBody(request);
      requireRole(db, body.teacherId || "teacher-1", "teacher");
      const item = db.classRequests.find((requestItem) => requestItem.id === parts[2]);
      if (!item) return send(response, 404, { error: "Class request not found" });
      item.status = body.status === "admitted" ? "admitted" : "declined";
      notify(db, item.studentId, item.status === "admitted" ? "Teacher admitted you to the class meeting." : "Teacher declined your class entry request.");
      writeDb(db);
      return send(response, 200, { item, state: publicState(db, body.teacherId) });
    }

    if (request.method === "POST" && urlPath === "/api/tests") {
      const body = await readBody(request);
      requireRole(db, body.teacherId || "teacher-1", "teacher");
      const item = {
        id: id("test"),
        teacherId: body.teacherId || "teacher-1",
        name: String(body.name || "Untitled test").trim(),
        fee: Number(body.fee || 0),
        time: String(body.time || "Time not set"),
        question: String(body.question || "Write your answer."),
        status: "scheduled",
        createdAt: new Date().toISOString()
      };
      db.tests.unshift(item);
      notify(db, "all-students", `New paid test: ${item.name}. Fee Rs ${item.fee}. Request admit and complete payment.`);
      writeDb(db);
      return send(response, 201, { item, state: publicState(db, body.teacherId) });
    }

    if (request.method === "POST" && parts[0] === "api" && parts[1] === "tests" && parts[3] === "request") {
      const body = await readBody(request);
      requireRole(db, body.studentId, "student");
      const test = db.tests.find((testItem) => testItem.id === parts[2]);
      if (!test) return send(response, 404, { error: "Test not found" });
      const existing = db.testRequests.find((item) => item.testId === test.id && item.studentId === body.studentId);
      if (existing) return send(response, 200, { item: existing, state: publicState(db, body.studentId) });
      const item = {
        id: id("test-request"),
        testId: test.id,
        studentId: body.studentId,
        paymentStatus: "pending",
        permissionStatus: "waiting",
        amount: test.fee,
        createdAt: new Date().toISOString()
      };
      db.testRequests.unshift(item);
      writeDb(db);
      return send(response, 201, { item, state: publicState(db, body.studentId) });
    }

    if (request.method === "PATCH" && parts[0] === "api" && parts[1] === "test-requests") {
      const body = await readBody(request);
      const item = db.testRequests.find((requestItem) => requestItem.id === parts[2]);
      if (!item) return send(response, 404, { error: "Test request not found" });
      const action = parts[3];
      if (action === "pay") {
        requireRole(db, body.userId || item.studentId, "student");
        item.paymentStatus = "paid";
        notify(db, item.studentId, "Payment sent to teacher. Waiting for exam permission.");
      }
      if (action === "confirm-payment") {
        requireRole(db, body.userId || "teacher-1", "teacher");
        item.paymentStatus = "confirmed";
        notify(db, item.studentId, "Teacher confirmed your payment. Waiting for exam permission.");
      }
      if (action === "permit") {
        requireRole(db, body.userId || "teacher-1", "teacher");
        if (item.paymentStatus === "pending") return send(response, 400, { error: "Payment must be completed first" });
        item.permissionStatus = "permitted";
        notify(db, item.studentId, "Teacher permitted your test. You can now enter exam mode.");
      }
      writeDb(db);
      return send(response, 200, { item, state: publicState(db, body.userId || item.studentId) });
    }

    if (request.method === "POST" && urlPath === "/api/assignments") {
      const body = await readBody(request);
      requireRole(db, body.teacherId || "teacher-1", "teacher");
      const item = {
        id: id("assignment"),
        teacherId: body.teacherId || "teacher-1",
        title: String(body.title || "Untitled assignment").trim(),
        dueDate: String(body.dueDate || "Due date not set"),
        instructions: String(body.instructions || "Complete and submit your homework."),
        createdAt: new Date().toISOString()
      };
      db.assignments.unshift(item);
      notify(db, "all-students", `New homework assigned: ${item.title}. Due ${item.dueDate}.`);
      writeDb(db);
      return send(response, 201, { item, state: publicState(db, body.teacherId) });
    }

    if (request.method === "POST" && parts[0] === "api" && parts[1] === "assignments" && parts[3] === "submit") {
      const body = await readBody(request);
      requireRole(db, body.studentId, "student");
      const assignment = db.assignments.find((assignmentItem) => assignmentItem.id === parts[2]);
      if (!assignment) return send(response, 404, { error: "Assignment not found" });
      let item = db.assignmentSubmissions.find((submission) => submission.assignmentId === assignment.id && submission.studentId === body.studentId);
      if (!item) {
        item = {
          id: id("submission"),
          assignmentId: assignment.id,
          studentId: body.studentId,
          answer: "",
          status: "submitted",
          feedback: "",
          createdAt: new Date().toISOString(),
          reviewedAt: ""
        };
        db.assignmentSubmissions.unshift(item);
      }
      item.answer = String(body.answer || "").trim();
      item.status = "submitted";
      item.createdAt = new Date().toISOString();
      notify(db, assignment.teacherId, `Homework submitted for ${assignment.title}.`);
      writeDb(db);
      return send(response, 201, { item, state: publicState(db, body.studentId) });
    }

    if (request.method === "PATCH" && parts[0] === "api" && parts[1] === "assignment-submissions" && parts[3] === "review") {
      const body = await readBody(request);
      requireRole(db, body.teacherId || "teacher-1", "teacher");
      const item = db.assignmentSubmissions.find((submission) => submission.id === parts[2]);
      if (!item) return send(response, 404, { error: "Assignment submission not found" });
      item.status = "reviewed";
      item.feedback = String(body.feedback || "Reviewed by teacher.");
      item.reviewedAt = new Date().toISOString();
      const assignment = db.assignments.find((assignmentItem) => assignmentItem.id === item.assignmentId);
      notify(db, item.studentId, `Teacher reviewed your homework: ${assignment?.title || "Assignment"}.`);
      writeDb(db);
      return send(response, 200, { item, state: publicState(db, body.teacherId || assignment?.teacherId) });
    }

    if (request.method === "POST" && urlPath === "/api/exam/flags") {
      const body = await readBody(request);
      const item = {
        id: id("flag"),
        studentId: body.studentId || "student-1",
        reason: String(body.reason || "Exam focus warning"),
        createdAt: new Date().toISOString()
      };
      db.examFlags.unshift(item);
      writeDb(db);
      return send(response, 201, { item, state: publicState(db, body.studentId) });
    }

    return send(response, 404, { error: "API route not found" });
  } catch (error) {
    return send(response, 400, { error: error.message || "Bad request" });
  }
}

function serveStatic(request, response, urlPath) {
  const filePath = path.resolve(root, urlPath === "/" ? "index.html" : `.${urlPath}`);
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(data);
  });
}

ensureDb();

const server = http.createServer((request, response) => {
  const parsed = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (parsed.pathname.startsWith("/api/")) {
    handleApi(request, response, parsed.pathname, parsed.searchParams);
    return;
  }
  serveStatic(request, response, decodeURIComponent(parsed.pathname));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`ClassBridge full system running on http://localhost:${port}`);
});
