const API_BASE = "https://opentdb.com";
let token = null;
let questions = [];
let current = 0;
let score = 0;
let timerId = null;
const QUESTION_TIME = 20;

const els = {
    setup: document.getElementById('setup'),
    form: document.getElementById('setup-form'),
    category: document.getElementById('category'),
    difficulty: document.getElementById('difficulty'),
    amount: document.getElementById('amount'),
    loader: document.getElementById('loader'),
    quiz: document.getElementById('quiz'),
    qText: document.getElementById('question'),
    answers: document.getElementById('answers'),
    next: document.getElementById('next'),
    result: document.getElementById('result'),
    scoreLine: document.getElementById('score-line'),
    summary: document.getElementById('summary'),
    progressBar: document.getElementById('progress-bar'),
    timer: document.getElementById('timer'),
    metaCat: document.getElementById('meta-category'),
    metaDiff: document.getElementById('meta-difficulty'),
    metaIndex: document.getElementById('meta-index'),
    restart: document.getElementById('restart'),
};

init();

async function init() {
    await ensureToken();
    await loadCategories();
    wireEvents();
}

function wireEvents() {
    els.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        startLoading();

        try {
            const amount = clamp(parseInt(els.amount.value || '10', 10), 5, 20);
            const category = els.category.value;
            const difficulty = els.difficulty.value;

            questions = await fetchQuestions({ amount, category, difficulty });

            if (!questions.length) throw new Error("No questions loaded");

            current = 0;
            score = 0;

            showQuiz();
            renderQuestion();

        } catch (err) {
            alert("Failed to load questions. Try different settings.");
            console.error(err);
        } finally {
            stopLoading();
        }
    });

    els.next.addEventListener('click', () => {
        current++;
        if (current >= questions.length) endQuiz();
        else renderQuestion();
    });

    els.restart.addEventListener('click', () => {
        els.result.classList.add('hidden');
        els.setup.classList.remove('hidden');
        els.progressBar.style.width = '0%';
        els.timer.textContent = '--';
    });
}

function startLoading() {
    els.setup.classList.add('hidden');
    els.quiz.classList.add('hidden');
    els.result.classList.add('hidden');
    els.loader.classList.remove('hidden');
}

function stopLoading() {
    els.loader.classList.add('hidden');
}

async function ensureToken() {
    if (token) return token;

    const res = await fetch(`${API_BASE}/api_token.php?command=request`);
    const data = await res.json();

    token = data.token || "";
    return token;
}

async function loadCategories() {
    const res = await fetch(`${API_BASE}/api_category.php`);
    const data = await res.json();

    const cats = [{ id: "", name: "Any" }, ...data.trivia_categories];

    els.category.innerHTML = cats
        .map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`)
        .join('');
}

async function fetchQuestions({ amount, category, difficulty }) {
    const params = new URLSearchParams({
        amount,
        type: "multiple",
        encode: "url3986"
    });

    if (category) params.append("category", category);
    if (difficulty) params.append("difficulty", difficulty);
    if (token) params.append("token", token);

    const res = await fetch(`${API_BASE}/api.php?${params.toString()}`);
    const data = await res.json();

    if (data.response_code === 4) {
        await fetch(`${API_BASE}/api_token.php?command=reset&token=${token}`);
        return fetchQuestions({ amount, category, difficulty });
    }

    if (data.response_code !== 0) return [];

    return data.results.map(q => ({
        category: decodeURIComponent(q.category),
        difficulty: decodeURIComponent(q.difficulty),
        question: decodeURIComponent(q.question),
        correct: decodeURIComponent(q.correct_answer),
        answers: shuffle([q.correct_answer, ...q.incorrect_answers].map(decodeURIComponent))
    }));
}

function showQuiz() {
    els.quiz.classList.remove('hidden');
    els.setup.classList.add('hidden');
}

function renderQuestion() {
    clearTimer();

    const q = questions[current];

    els.qText.textContent = q.question;
    els.metaCat.textContent = q.category;
    els.metaDiff.textContent = q.difficulty;
    els.metaIndex.textContent = `${current + 1}/${questions.length}`;

    els.answers.innerHTML = "";
    els.next.disabled = true;

    q.answers.forEach(ans => {
        const btn = document.createElement("button");
        btn.className = "answer";
        btn.textContent = ans;
        btn.onclick = () => selectAnswer(btn, ans === q.correct);
        els.answers.appendChild(btn);
    });

    const pct = (current / questions.length) * 100;
    els.progressBar.style.width = `${pct}%`;

    startTimer(QUESTION_TIME, () => {
        lockAnswers();
        Array.from(els.answers.children).forEach(b => {
            if (b.textContent === q.correct) b.classList.add("correct");
        });
        els.next.disabled = false;
    });
}

function selectAnswer(btn, isCorrect) {
    lockAnswers();

    if (isCorrect) {
        btn.classList.add("correct");
        score++;
    } else {
        btn.classList.add("wrong");
        const q = questions[current];
        Array.from(els.answers.children).forEach(b => {
            if (b.textContent === q.correct) b.classList.add("correct");
        });
    }

    els.next.disabled = false;
    clearTimer();
}

function lockAnswers() {
    Array.from(els.answers.children).forEach(b => b.disabled = true);
}

function endQuiz() {
    clearTimer();
    els.quiz.classList.add('hidden');
    els.result.classList.remove('hidden');
    els.progressBar.style.width = '100%';

    els.scoreLine.textContent = `Your score: ${score} / ${questions.length}`;

    els.summary.innerHTML = questions.map((q, i) => `
        <li>
            <strong>Q${i + 1}:</strong> ${escapeHTML(q.question)}<br>
            <small>Correct: ${escapeHTML(q.correct)}</small>
        </li>
    `).join('');
}

function startTimer(seconds, onEnd) {
    let remaining = seconds;
    els.timer.textContent = remaining;

    timerId = setInterval(() => {
        remaining--;
        els.timer.textContent = remaining;

        if (remaining <= 0) {
            clearInterval(timerId);
            timerId = null;
            onEnd();
        }
    }, 1000);
}

function clearTimer() {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function escapeHTML(s) {
    return s.replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
