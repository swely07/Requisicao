
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBD6vQzxU-iU5VAaNpSiLtkQF9_aEGRbvk",
  authDomain: "epbjc-d8534.firebaseapp.com",
  projectId: "epbjc-d8534",
  storageBucket: "epbjc-d8534.firebasestorage.app",
  messagingSenderId: "519965369577",
  appId: "1:519965369577:web:30e83c18024e535f2e7c78",
  measurementId: "G-1CZ8CEC63S"
};

// Domínio institucional
export const DOMAIN = "@alunos.epbjc.pt";

// Inicialização do Firebase
export const configured = firebaseConfig.apiKey !== "INSERIR";

const app = configured ? initializeApp(firebaseConfig) : null;

// Autenticação
export const auth = app ? getAuth(app) : null;

// Base de dados
export const db = app ? getFirestore(app) : null;
