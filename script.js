/* =========================================================
   身内クイズゲーム
   メインゲームプログラム
========================================================= */


/* =========================================================
   API設定
========================================================= */

// ★ここにApps ScriptのWebアプリURLを入れる
const API_URL =https://script.google.com/macros/s/AKfycbwQgu1Q4r056JLF3L6ovhy1ChnL5LQissSgBOvj9kLyQA4Bqsf7cSV4BbveEffJjdit/exec
  "ここにあなたのWebアプリURLを貼り付ける";


/* =========================================================
   ゲーム設定
========================================================= */

const GAME_CONFIG = {

  // 1問終了後、自動的に次の問題へ進むまでの時間
  nextQuestionDelay: 1500

};


/* =========================================================
   ゲーム状態
========================================================= */

const gameState = {

  session: null,

  score: 0,

  genres: [],

  currentGenre: null,

  currentQuestion: null,

  timerId: null,

  timerStart: 0,

  timerEnd: 0,

  answering: false,

  answerShown: false

};


/* =========================================================
   DOM
========================================================= */

const screens = {

  login:
    document.getElementById("login-screen"),

  genre:
    document.getElementById("genre-screen"),

  quiz:
    document.getElementById("quiz-screen"),

  result:
    document.getElementById("result-screen")

};


const elements = {

  accessCode:
    document.getElementById("access-code"),

  loginButton:
    document.getElementById("login-button"),

  loginMessage:
    document.getElementById("login-message"),

  genreList:
    document.getElementById("genre-list"),

  genreMessage:
    document.getElementById("genre-message"),

  score:
    document.getElementById("score"),

  currentGenre:
    document.getElementById("current-genre"),

  questionPoint:
    document.getElementById("question-point"),

  timer:
    document.getElementById("timer"),

  timerBarFill:
    document.getElementById("timer-bar-fill"),

  questionText:
    document.getElementById("question-text"),

  answerArea:
    document.getElementById("answer-area"),

  answerText:
    document.getElementById("answer-text"),

  judgeArea:
    document.getElementById("judge-area"),

  correctButton:
    document.getElementById("correct-button"),

  wrongButton:
    document.getElementById("wrong-button"),

  quizMessage:
    document.getElementById("quiz-message"),

  resultScore:
    document.getElementById("result-score"),

  backGenreButton:
    document.getElementById("back-genre-button")

};


/* =========================================================
   初期化
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  elements.loginButton.addEventListener(
    "click",
    handleLogin
  );


  elements.accessCode.addEventListener(
    "keydown",
    (event) => {

      if (event.key === "Enter") {
        handleLogin();
      }

    }
  );


  elements.correctButton.addEventListener(
    "click",
    () => judgeAnswer(true)
  );


  elements.wrongButton.addEventListener(
    "click",
    () => judgeAnswer(false)
  );


  elements.backGenreButton.addEventListener(
    "click",
    () => {

      showScreen("genre");

      elements.genreMessage.textContent = "";

    }
  );


  updateScore();

});


/* =========================================================
   画面切り替え
========================================================= */

function showScreen(screenName) {

  Object.values(screens).forEach(
    screen => screen.classList.remove("active")
  );


  screens[screenName].classList.add("active");

}


/* =========================================================
   API共通処理
========================================================= */

async function callApi(action, params = {}) {

  const query = new URLSearchParams();

  query.set("action", action);


  Object.entries(params).forEach(
    ([key, value]) => {

      query.set(key, value);

    }
  );


  const url =
    `${API_URL}?${query.toString()}`;


  const response =
    await fetch(url, {
      method: "GET",
      redirect: "follow"
    });


  if (!response.ok) {

    throw new Error(
      `API通信エラー: ${response.status}`
    );

  }


  const data =
    await response.json();


  return data;

}


/* =========================================================
   ログイン
========================================================= */

async function handleLogin() {

  const code =
    elements.accessCode.value.trim();


  if (!code) {

    elements.loginMessage.textContent =
      "アクセスコードを入力してください。";

    return;

  }


  elements.loginButton.disabled = true;

  elements.loginMessage.textContent =
    "接続しています……";


  try {

    const data =
      await callApi(
        "login",
        {
          code: code
        }
      );


    if (!data.success) {

      throw new Error(
        data.message || "ログインできませんでした"
      );

    }


    gameState.session =
      data.session;


    // ページをリロードしても一時的に保持
    sessionStorage.setItem(
      "quiz_session",
      gameState.session
    );


    elements.loginMessage.textContent = "";


    await loadGenres();


  } catch (error) {

    console.error(error);

    elements.loginMessage.textContent =
      error.message;

  } finally {

    elements.loginButton.disabled = false;

  }

}


/* =========================================================
   ジャンル取得
========================================================= */

async function loadGenres() {

  showScreen("genre");


  elements.genreList.innerHTML =
    "<p>ジャンルを読み込んでいます……</p>";


  try {

    const data =
      await callApi(
        "genres",
        {
          session: gameState.session
        }
      );


    if (!data.success) {

      throw new Error(
        data.message || "ジャンルを取得できませんでした"
      );

    }


    gameState.genres =
      data.genres || [];


    renderGenres();


  } catch (error) {

    console.error(error);

    elements.genreList.innerHTML = "";

    elements.genreMessage.textContent =
      error.message;

  }

}


/* =========================================================
   ジャンル表示
========================================================= */

function renderGenres() {

  elements.genreList.innerHTML = "";


  if (gameState.genres.length === 0) {

    elements.genreMessage.textContent =
      "選択できるジャンルがありません。";

    return;

  }


  gameState.genres.forEach(
    genreData => {

      const button =
        document.createElement("button");


      button.className =
        "genre-button";


      button.textContent =
        genreData.display || genreData.genre;


      button.addEventListener(
        "click",
        () => {

          startQuiz(
            genreData.genre
          );

        }
      );


      elements.genreList.appendChild(button);

    }
  );

}


/* =========================================================
   クイズ開始
========================================================= */

async function startQuiz(genre) {

  gameState.currentGenre =
    genre;


  elements.currentGenre.textContent =
    genre;


  showScreen("quiz");


  resetQuizUI();


  elements.quizMessage.textContent =
    "問題を読み込んでいます……";


  try {

    const data =
      await callApi(
        "question",
        {
          session: gameState.session,
          genre: genre
        }
      );


    if (!data.success) {

      throw new Error(
        data.message ||
        "問題を取得できませんでした"
      );

    }


    gameState.currentQuestion =
      data.question;


    elements.quizMessage.textContent = "";


    displayQuestion();


  } catch (error) {

    console.error(error);

    elements.quizMessage.textContent =
      error.message;

  }

}


/* =========================================================
   問題表示
========================================================= */

function displayQuestion() {

  const question =
    gameState.currentQuestion;


  elements.questionText.textContent =
    question.question;


  elements.questionPoint.textContent =
    question.point;


  gameState.answerShown = false;

  gameState.answering = true;


  startTimer(
    Number(question.time)
  );

}


/* =========================================================
   タイマー
========================================================= */

function startTimer(seconds) {

  clearTimer();


  const duration =
    seconds * 1000;


  gameState.timerStart =
    Date.now();


  gameState.timerEnd =
    gameState.timerStart + duration;


  updateTimer();


  gameState.timerId =
    setInterval(
      updateTimer,
      50
    );

}


/* =========================================================
   タイマー更新
========================================================= */

function updateTimer() {

  const now =
    Date.now();


  const remaining =
    Math.max(
      0,
      gameState.timerEnd - now
    );


  const total =
    gameState.timerEnd -
    gameState.timerStart;


  const seconds =
    Math.ceil(
      remaining / 1000
    );


  elements.timer.textContent =
    seconds;


  const ratio =
    total > 0
      ? remaining / total
      : 0;


  elements.timerBarFill.style.width =
    `${Math.max(0, ratio * 100)}%`;


  if (remaining <= 0) {

    clearTimer();

    handleTimeUp();

  }

}


/* =========================================================
   タイマー停止
========================================================= */

function clearTimer() {

  if (gameState.timerId !== null) {

    clearInterval(
      gameState.timerId
    );

    gameState.timerId = null;

  }

}


/* =========================================================
   時間切れ
========================================================= */

async function handleTimeUp() {

  if (!gameState.answering) {
    return;
  }


  gameState.answering = false;


  elements.timer.textContent =
    "0";


  elements.quizMessage.textContent =
    "時間切れ！答えを確認しています……";


  await fetchAnswer();

}


/* =========================================================
   答え取得
========================================================= */

async function fetchAnswer() {

  const question =
    gameState.currentQuestion;


  if (!question) {
    return;
  }


  try {

    const data =
      await callApi(
        "answer",
        {
          session: gameState.session,
          id: question.id
        }
      );


    /*
      念のためサーバー側がまだ
      時間切れと判定していない場合にも対応
    */

    if (!data.success) {

      if (data.error === "TOO_EARLY") {

        const remaining =
          Number(data.remaining || 1);


        setTimeout(
          fetchAnswer,
          Math.max(
            500,
            remaining * 1000
          )
        );


        return;

      }


      throw new Error(
        data.message ||
        "答えを取得できませんでした"
      );

    }


    showAnswer(
      data.answer
    );


  } catch (error) {

    console.error(error);

    elements.quizMessage.textContent =
      error.message;

  }

}


/* =========================================================
   答え表示
========================================================= */

function showAnswer(answer) {

  gameState.answerShown = true;


  elements.answerText.textContent =
    answer;


  elements.answerArea.classList.remove(
    "hidden"
  );


  elements.judgeArea.classList.remove(
    "hidden"
  );


  elements.quizMessage.textContent =
    "あなたの回答が正解だったか選んでください。";

}


/* =========================================================
   正解 / 不正解
========================================================= */

function judgeAnswer(isCorrect) {

  if (!gameState.answerShown) {
    return;
  }


  /*
    二重クリック防止
  */

  elements.correctButton.disabled = true;

  elements.wrongButton.disabled = true;


  if (isCorrect) {

    const point =
      Number(
        gameState.currentQuestion.point
      ) || 0;


    gameState.score += point;


    elements.quizMessage.textContent =
      `正解！ +${point}ポイント`;

  } else {

    elements.quizMessage.textContent =
      "不正解。ポイントは入りません。";

  }


  updateScore();


  /*
    少し間を置いて次の問題へ
  */

  setTimeout(
    () => {

      resetQuizUI();

      startQuiz(
        gameState.currentGenre
      );

    },
    GAME_CONFIG.nextQuestionDelay
  );

}


/* =========================================================
   UIリセット
========================================================= */

function resetQuizUI() {

  clearTimer();


  elements.questionText.textContent =
    "問題を読み込んでいます……";


  elements.questionPoint.textContent =
    "0";


  elements.timer.textContent =
    "0";


  elements.timerBarFill.style.width =
    "100%";


  elements.answerText.textContent =
    "---";


  elements.answerArea.classList.add(
    "hidden"
  );


  elements.judgeArea.classList.add(
    "hidden"
  );


  elements.correctButton.disabled =
    false;


  elements.wrongButton.disabled =
    false;


  elements.quizMessage.textContent =
    "";

}


/* =========================================================
   スコア更新
========================================================= */

function updateScore() {

  elements.score.textContent =
    gameState.score;


  elements.resultScore.textContent =
    gameState.score;

}


/* =========================================================
   ページを再読み込みした場合
========================================================= */

function restoreSession() {

  const savedSession =
    sessionStorage.getItem(
      "quiz_session"
    );


  if (!savedSession) {
    return false;
  }


  gameState.session =
    savedSession;


  return true;

}