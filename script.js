"use strict";

/*
 * Apps Script WebアプリURLをここに設定してください。
 * 例:
 * const API_URL = "https://script.google.com/macros/s/AKfycbwQgu1Q4r056JLF3L6ovhy1ChnL5LQissSgBOvj9kLyQA4Bqsf7cSV4BbveEffJjdit/exec";
 */
const API_URL = "ここにあなたのWebアプリURLを貼り付ける";

const state = {
  session: "",
  genres: [],
  currentGenre: "",
  currentQuestion: null,
  score: 0,
  timerId: null,
  remainingTime: 0,
  answering: false,
  loading: false
};

const loginScreen = document.getElementById("login-screen");
const genreScreen = document.getElementById("genre-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultScreen = document.getElementById("result-screen");

const accessCodeInput = document.getElementById("access-code");
const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");

const loginMessage = document.getElementById("login-message");
const genreMessage = document.getElementById("genre-message");
const quizMessage = document.getElementById("quiz-message");

const genreList = document.getElementById("genre-list");
const scoreElement = document.getElementById("score");
const finalScoreElement = document.getElementById("final-score");

const quizGenreElement = document.getElementById("quiz-genre");
const quizPointElement = document.getElementById("quiz-point");
const timerElement = document.getElementById("timer");
const questionTextElement = document.getElementById("question-text");

const answerArea = document.getElementById("answer-area");
const answerTextElement = document.getElementById("answer-text");
const judgeArea = document.getElementById("judge-area");

const correctButton = document.getElementById("correct-button");
const wrongButton = document.getElementById("wrong-button");

document.addEventListener("DOMContentLoaded", () => {
  updateScore();

  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", restartGame);

  correctButton.addEventListener("click", () => judgeAnswer(true));
  wrongButton.addEventListener("click", () => judgeAnswer(false));

  accessCodeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      startGame();
    }
  });
});

function showScreen(screen) {
  [
    loginScreen,
    genreScreen,
    quizScreen,
    resultScreen
  ].forEach((item) => item.classList.remove("active"));

  screen.classList.add("active");
}

async function callApi(action, params = {}) {
  if (
    !API_URL ||
    API_URL.includes("ここにあなたのWebアプリURL")
  ) {
    throw new Error(
      "script.js の API_URL にApps ScriptのWebアプリURLを設定してください。"
    );
  }

  const url = new URL(API_URL);
  url.searchParams.set("action", action);

  Object.keys(params).forEach((key) => {
    const value = params[key];

    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  let response;

  try {
    response = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      cache: "no-store"
    });
  } catch (error) {
    throw new Error(
      "API通信に失敗しました。\n" +
      "Apps ScriptのURL、公開設定、またはブラウザのCORS制限を確認してください。\n\n" +
      error.message
    );
  }

  if (!response.ok) {
    throw new Error("APIエラー: HTTP " + response.status);
  }

  let data;

  try {
    data = await response.json();
  } catch (error) {
    throw new Error("APIから正しいJSONを受け取れませんでした。");
  }

  if (!data.success) {
    throw new Error(
      data.message ||
      data.error ||
      "APIでエラーが発生しました。"
    );
  }

  return data;
}

async function startGame() {
  if (state.loading) {
    return;
  }

  const code = accessCodeInput.value.trim();

  if (!code) {
    loginMessage.textContent = "アクセスコードを入力してください。";
    return;
  }

  state.loading = true;
  startButton.disabled = true;
  loginMessage.textContent = "接続中……";

  try {
    const data = await callApi("login", { code });

    state.session = data.session;
    state.score = 0;

    updateScore();

    sessionStorage.setItem("quiz_session", state.session);

    loginMessage.textContent = "";

    await loadGenres();
  } catch (error) {
    console.error(error);
    loginMessage.textContent = error.message;
  } finally {
    state.loading = false;
    startButton.disabled = false;
  }
}

async function loadGenres() {
  genreMessage.textContent = "ジャンルを読み込み中……";

  try {
    const data = await callApi("genres", {
      session: state.session
    });

    state.genres = Array.isArray(data.genres)
      ? data.genres
      : [];

    if (state.genres.length === 0) {
      throw new Error("選択できるジャンルがありません。");
    }

    renderGenres();
    genreMessage.textContent = "";
    showScreen(genreScreen);
  } catch (error) {
    console.error(error);
    genreMessage.textContent = error.message;
  }
}

function renderGenres() {
  genreList.innerHTML = "";

  state.genres.forEach((item) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "genre-button";
    button.textContent = item.display || item.genre;

    button.addEventListener("click", () => {
      selectGenre(item.genre);
    });

    genreList.appendChild(button);
  });
}

async function selectGenre(genre) {
  if (state.loading) {
    return;
  }

  state.currentGenre = genre;
  state.loading = true;
  genreMessage.textContent = "問題を読み込み中……";

  try {
    await loadQuestion();
  } catch (error) {
    console.error(error);
    genreMessage.textContent = error.message;
  } finally {
    state.loading = false;
  }
}

async function loadQuestion() {
  stopTimer();

  hideAnswerArea();
  hideJudgeArea();

  quizMessage.textContent = "";

  const data = await callApi("question", {
    session: state.session,
    genre: state.currentGenre
  });

  state.currentQuestion = data.question;

  if (!state.currentQuestion) {
    throw new Error("問題データが取得できませんでした。");
  }

  quizGenreElement.textContent = state.currentGenre;
  quizPointElement.textContent = state.currentQuestion.point;
  questionTextElement.textContent = state.currentQuestion.question;

  showScreen(quizScreen);

  startTimer(Number(state.currentQuestion.time) || 10);
}

function startTimer(seconds) {
  stopTimer();

  state.remainingTime = Math.max(0, Math.ceil(seconds));
  updateTimer();

  state.timerId = setInterval(() => {
    state.remainingTime--;
    updateTimer();

    if (state.remainingTime <= 0) {
      stopTimer();
      revealAnswer();
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerId !== null) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateTimer() {
  timerElement.textContent = String(
    Math.max(0, state.remainingTime)
  );

  timerElement.classList.remove("warning", "danger");

  if (state.remainingTime <= 3) {
    timerElement.classList.add("danger");
  } else if (state.remainingTime <= 5) {
    timerElement.classList.add("warning");
  }
}

async function revealAnswer() {
  if (state.answering || !state.currentQuestion) {
    return;
  }

  state.answering = true;
  quizMessage.textContent = "答えを取得中……";

  try {
    const data = await callApi("answer", {
      session: state.session,
      id: state.currentQuestion.id
    });

    answerTextElement.textContent = data.answer;

    showAnswerArea();
    showJudgeArea();

    quizMessage.textContent =
      "自分の答えと照らし合わせてください。";
  } catch (error) {
    console.error(error);

    if (
      error.message.includes("まだ制限時間") ||
      error.message.includes("TOO_EARLY")
    ) {
      setTimeout(() => {
        state.answering = false;
        revealAnswer();
      }, 1000);

      return;
    }

    quizMessage.textContent = error.message;
  }

  state.answering = false;
}

function showAnswerArea() {
  answerArea.classList.remove("hidden");
}

function hideAnswerArea() {
  answerArea.classList.add("hidden");
  answerTextElement.textContent = "---";
}

function showJudgeArea() {
  judgeArea.classList.remove("hidden");
}

function hideJudgeArea() {
  judgeArea.classList.add("hidden");
}

function judgeAnswer(isCorrect) {
  if (!state.currentQuestion) {
    return;
  }

  correctButton.disabled = true;
  wrongButton.disabled = true;

  if (isCorrect) {
    state.score += Number(state.currentQuestion.point) || 0;
  }

  updateScore();

  setTimeout(() => {
    correctButton.disabled = false;
    wrongButton.disabled = false;
    nextQuestion();
  }, 500);
}

async function nextQuestion() {
  state.loading = true;

  try {
    await loadQuestion();
  } catch (error) {
    console.error(error);

    if (
      error.message.includes("出題できる問題がありません")
    ) {
      showResult();
    } else {
      quizMessage.textContent = error.message;
    }
  } finally {
    state.loading = false;
  }
}

function updateScore() {
  scoreElement.textContent = String(state.score);
}

function showResult() {
  stopTimer();
  finalScoreElement.textContent = String(state.score);
  showScreen(resultScreen);
}

async function restartGame() {
  stopTimer();

  state.currentGenre = "";
  state.currentQuestion = null;
  state.score = 0;
  state.answering = false;
  state.loading = false;

  updateScore();

  hideAnswerArea();
  hideJudgeArea();

  if (!state.session) {
    showScreen(loginScreen);
    return;
  }

  showScreen(genreScreen);

  try {
    await loadGenres();
  } catch (error) {
    console.error(error);
    genreMessage.textContent = error.message;
  }
}
