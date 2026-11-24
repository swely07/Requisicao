
import { auth, db, configured, DOMAIN } from './firebase.js';

import {
    onAuthStateChanged,
    OAuthProvider,
    signInWithPopup,
    signOut
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    addDoc,
    runTransaction,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
const page = document.body.dataset.page;

const msg = t => {
    if ($('message')) $('message').textContent = t;
};

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));

let user;
let admin = false;
let requests = [];
let items = [];

const valid = u =>
    u?.email?.toLowerCase().endsWith(DOMAIN) &&
    u.emailVerified;

const table = (heads, rows) => `
    <div class="panel scroll">
        <table>
            <thead>
                <tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${rows.length ? rows.join('') :
                `<tr><td colspan="${heads.length}">Sem registos.</td></tr>`}
            </tbody>
        </table>
    </div>
`;

const button = (id, state, label) => `
    <button data-id="${esc(id)}" data-state="${state}">
        ${label}
    </button>
`;

// Carregar dados do Firestore

async function load() {
    const rq = collection(db, 'requisicoes');

    requests = (
        await getDocs(
            admin ? rq : query(rq, where('uid', '==', user.uid))
        )
    ).docs.map(d => ({
        ...d.data(),
        id: d.id
    })).sort((a, b) =>
        (b.criadoEm?.seconds || 0) -
        (a.criadoEm?.seconds || 0)
    );

    items = (
        await getDocs(collection(db, 'equipamentos'))
    ).docs.map(d => ({
        ...d.data(),
        id: d.id
    }));

    render();
}

// Apresentar os dados nas páginas

function render() {
    const c = $('content');
    if (!c) return;

    const rows = (rs, actions = false) => rs.map(r => `
        <tr>
            <td>${esc(r.codigo)}</td>
            <td>${esc(r.equipamento)}</td>
            <td>${esc(r.dataPedido)}</td>
            <td>${esc(r.devolucaoPrevista)}</td>
            <td><span class="tag">${esc(r.estado)}</span></td>
            <td>
                ${actions && admin ?
                    (r.estado === 'Pendente' ?
                        button(r.id, 'Aprovado', 'Aprovar') +
                        button(r.id, 'Recusado', 'Rejeitar') :
                    r.estado === 'Aprovado' ?
                        button(r.id, 'Em empréstimo', 'Entregar') :
                    r.estado === 'Em empréstimo' ?
                        button(r.id, 'Devolvido', 'Devolver') :
                    '') : ''}
            </td>
        </tr>
    `);

    const heads = [
        'Código',
        'Equipamento',
        'Pedido',
        'Devolução prevista',
        'Estado',
        'Ações'
    ];

    // Dashboard

    if (page === 'dashboard') {
        c.innerHTML = `
            <div class="stats">
                ${[
                    ['Pedidos', requests.length],
                    ['Pendentes', requests.filter(r =>
                        r.estado === 'Pendente').length],
                    ['Em empréstimo', requests.filter(r =>
                        r.estado === 'Em empréstimo').length],
                    ['Disponíveis', items.reduce((s, i) =>
                        s + i.disponivel, 0)]
                ].map(([k, v]) => `
                    <div class="stat">
                        ${k}<strong>${v}</strong>
                    </div>
                `).join('')}
            </div>

            <h2>Atividade recente</h2>
            ${table(heads, rows(requests.slice(0, 5)))}
        `;
    }

    // Pedidos

    if (page === 'pedidos') {
        c.innerHTML = table(heads, rows(requests, true));
    }

    // Entregas e devoluções

    if (page === 'entregas' || page === 'devolucoes') {
        c.innerHTML = table(heads, rows(
            requests.filter(r =>
                page === 'entregas' ?
                ['Aprovado', 'Em empréstimo'].includes(r.estado) :
                ['Em empréstimo', 'Devolvido'].includes(r.estado)
            ), true
        ));
    }

    // Inventário

    if (page === 'inventario') {
        c.innerHTML = (admin ? `
            <form id="inventory" class="panel">
                <h2>Adicionar equipamento</h2>

                <label>Nome
                    <input name="nome" required maxlength="100">
                </label>

                <label>Quantidade
                    <input name="quantidade" type="number"
                        min="1" max="10000" required>
                </label>

                <button>Adicionar</button>
            </form>
        ` : '') + table(
            ['Equipamento', 'Total', 'Disponível'],
            items.map(i => `
                <tr>
                    <td>${esc(i.nome)}</td>
                    <td>${esc(i.quantidade)}</td>
                    <td>${esc(i.disponivel)}</td>
                </tr>
            `)
        );
    }

    // Nova requisição

    if (page === 'nova-requisicao') {
        c.innerHTML = `
            <form id="request" class="panel">

                <label>Equipamento
                    <select name="equipamentoId" required>
                        <option value="">Selecionar</option>
                        ${items.filter(i => i.disponivel > 0)
                            .map(i => `
                                <option value="${esc(i.id)}">
                                    ${esc(i.nome)} (${i.disponivel})
                                </option>
                            `).join('')}
                    </select>
                </label>

                <label>Data do pedido
                    <input name="dataPedido" type="date" required>
                </label>

                <label>Devolução prevista
                    <input name="devolucaoPrevista"
                        type="date" required>
                </label>

                <label>Observações
                    <textarea name="observacoes"
                        maxlength="500"></textarea>
                </label>

                <button>Enviar pedido</button>

            </form>
        `;
    }
}

// Alterar o estado das requisições

async function change(id, state) {
    if (!admin) throw Error('Acesso restrito.');

    await runTransaction(db, async tx => {
        const ref = doc(db, 'requisicoes', id);
        const snap = await tx.get(ref);
        const r = snap.data();

        const allowed = {
            'Pendente': ['Aprovado', 'Recusado'],
            'Aprovado': ['Em empréstimo'],
            'Em empréstimo': ['Devolvido']
        };

        if (!allowed[r.estado]?.includes(state)) {
            throw Error('Transição inválida.');
        }

        if (state === 'Aprovado' || state === 'Devolvido') {
            const ir = doc(db, 'equipamentos', r.equipamentoId);
            const i = (await tx.get(ir)).data();

            const n = i.disponivel +
                (state === 'Aprovado' ? -1 : 1);

            if (n < 0 || n > i.quantidade) {
                throw Error('Quantidade indisponível.');
            }

            tx.update(ir, { disponivel: n });
        }

        tx.update(ref, {
            estado: state,
            atualizadoEm: serverTimestamp()
        });
    });
}

// Configuração e autenticação

if (!configured) {

    msg('Configura js/firebase.js com os dados do teu projeto Firebase.');

    document.querySelectorAll('button').forEach(b => {
        b.disabled = true;
    });

} else {

    // Verificar sessão do utilizador

    onAuthStateChanged(auth, async u => {
        try {

            if (!u) {
                if (page !== 'login') {
                    location.replace('login.html');
                }
                return;
            }

            if (!valid(u)) {
                msg('Conta institucional não autorizada ou email não verificado.');
                await signOut(auth);

                if (page !== 'login') {
                    location.replace('login.html');
                }

                return;
            }

            if (page === 'login') {
                location.replace('dashboard.html');
                return;
            }

            user = u;

            admin = (
                await getDoc(doc(db, 'admins', u.uid))
            ).exists();

            if ($('identity')) {
                $('identity').textContent =
                    u.email + ' · ' +
                    (admin ? 'Administrador' : 'Utilizador');
            }

            document.querySelector(
                `[data-nav="${page}"]`
            )?.classList.add('active');

            await load();

        } catch (e) {
            msg(e.message);
            console.error(e);
        }
    });

    // Login com Microsoft

    $('login')?.addEventListener('submit', async e => {
        e.preventDefault();

        const loginButton = $('microsoftLogin');

        loginButton.disabled = true;
        msg('A iniciar sessão...');

        try {

            const provider = new OAuthProvider('microsoft.com');

            provider.setCustomParameters({
                prompt: 'select_account',
                tenant: "4334e4b0-48f4-4a76-ae54-cec847437a72"
            });

            await signInWithPopup(auth, provider);

        } catch (error) {

            console.error(error);
            msg(error.message);

        } finally {

            loginButton.disabled = false;

        }
    });

    // Terminar sessão

    $('logout')?.addEventListener('click', async () => {
        try {
            await signOut(auth);
            location.replace('login.html');
        } catch (error) {
            msg(error.message);
        }
    });

    // Guardar equipamentos e requisições

    $('content')?.addEventListener('submit', async e => {
        e.preventDefault();

        const f = e.target;
        const d = Object.fromEntries(new FormData(f));
        const b = f.querySelector('button');

        b.disabled = true;

        try {

            if (f.id === 'inventory' && admin) {

                const q = Number(d.quantidade);

                if (!Number.isInteger(q) || q < 1) {
                    throw Error('Quantidade inválida.');
                }

                await addDoc(collection(db, 'equipamentos'), {
                    nome: d.nome.trim(),
                    quantidade: q,
                    disponivel: q
                });

            } else if (f.id === 'request') {

                const i = items.find(x =>
                    x.id === d.equipamentoId
                );

                if (!i || d.devolucaoPrevista < d.dataPedido) {
                    throw Error('Verifica equipamento e datas.');
                }

                await addDoc(collection(db, 'requisicoes'), {
                    ...d,
                    equipamento: i.nome,
                    uid: user.uid,
                    email: user.email,
                    requisitante: user.displayName || user.email,
                    codigo: 'REQ-' +
                        crypto.randomUUID().slice(0, 8).toUpperCase(),
                    estado: 'Pendente',
                    criadoEm: serverTimestamp()
                });
            }

            await load();
            msg('Registo guardado.');

        } catch (err) {

            msg(err.message);
            b.disabled = false;

        }
    });

    // Botões de aprovação, rejeição, entrega e devolução

    $('content')?.addEventListener('click', async e => {

        const b = e.target.closest('button[data-state]');

        if (!b) return;

        b.disabled = true;

        try {

            await change(b.dataset.id, b.dataset.state);
            await load();

            msg('Estado atualizado.');

        } catch (err) {

            msg(err.message);
            b.disabled = false;

        }
    });
}
