// ============================================================
// api.js — Глобальные переменные + HTTP запросы
// ============================================================
var TOKEN = localStorage.getItem("cir_token") || "";
var USER = null;
var REFS = {
  operations: [],
  machines: [],
  objectTypes: [],
  units: [],
  coatings: [],
  materials: [],
  assortments: [],
};
var OPS_PAGE = 1;
var acTimers = {};
try {
  USER = JSON.parse(localStorage.getItem("cir_user") || "null");
} catch (e) {}

function http(method, url, data, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open(method, url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  if (TOKEN) xhr.setRequestHeader("Authorization", "Bearer " + TOKEN);
  xhr.onload = function () {
    if (xhr.status === 401) {
      if (typeof doLogout === "function") doLogout();
      return;
    }
    var res;
    try {
      res = JSON.parse(xhr.responseText);
    } catch (e) {
      res = { ok: false, error: "Ошибка: " + xhr.responseText.slice(0, 80) };
    }
    if (cb) cb(res);
  };
  xhr.onerror = function () {
    if (cb) cb({ ok: false, error: "Нет связи с сервером" });
  };
  xhr.send(data ? JSON.stringify(data) : null);
}

function httpUpload(method, url, data, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open(method, url, true);
  if (TOKEN) xhr.setRequestHeader("Authorization", "Bearer " + TOKEN);
  xhr.onload = function () {
    if (xhr.status === 401) {
      if (typeof doLogout === "function") doLogout();
      return;
    }
    var res;
    try {
      res = JSON.parse(xhr.responseText);
    } catch (e) {
      res = { ok: false, error: "Ошибка: " + xhr.responseText.slice(0, 80) };
    }
    if (cb) cb(res);
  };
  xhr.onerror = function () {
    if (cb) cb({ ok: false, error: "Нет связи с сервером" });
  };
  xhr.send(data);
}

function showToast(msg) {
  var t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(function () {
    t.classList.remove("show");
  }, 2800);
}

function api(method, url, data) {
  return new Promise(function (resolve) {
    http(method, url, data, function (res) {
      resolve(res);
    });
  });
}
