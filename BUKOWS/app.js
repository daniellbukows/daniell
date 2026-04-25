/**
 * Future - Motor de Cálculo e Lógica
 */

// Chaves do LocalStorage
const LS_TX = 'fin_transactions';
const LS_REC = 'fin_recurrences';
const LS_LOGGED = 'fin_logged_in';

// Estado global da aplicação
let state = {
    transactions: JSON.parse(localStorage.getItem(LS_TX)) || [],
    recurrences: JSON.parse(localStorage.getItem(LS_REC)) || [],
    isLoggedIn: localStorage.getItem(LS_LOGGED) === 'true'
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    if (state.isLoggedIn) {
        if (false) {
            seedData();
        }
        nav('dashboard');
    } else {
        showScreen('welcome');
    }
});

function seedData() {
    let today = new Date();
    state.transactions.push({ id: generateId(), value: 2500, date: formatDate(today), desc: 'Saldo Inicial' });
    state.recurrences.push({ id: generateId(), value: 5000, day: 5, desc: 'Salário' });
    state.recurrences.push({ id: generateId(), value: -1200, day: 10, desc: 'Aluguel' });
    state.recurrences.push({ id: generateId(), value: -300, day: 15, desc: 'Supermercado' });
    saveData();
}

function saveData() {
    localStorage.setItem(LS_TX, JSON.stringify(state.transactions));
    localStorage.setItem(LS_REC, JSON.stringify(state.recurrences));
}

// --- NAVEGAÇÃO E TELAS ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screenId}`).classList.add('active');
}

function nav(screenId) {
    showScreen(screenId);

    // Mostra/Atualiza o Bottom Nav
    document.getElementById('bottom-nav').style.display = 'flex';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${screenId}`);
    if (activeNav) activeNav.classList.add('active');

    // Renderiza dados conforme a tela atual
    updateViewData(screenId);
}

function updateViewData(screenId) {
    if (screenId === 'dashboard') renderDashboard();
    if (screenId === 'diary') renderDiary();
    if (screenId === 'forecast') renderForecast();
    if (screenId === 'recurrences') renderRecurrences();
}

// --- AUTENTICAÇÃO ---
function doLogin() {
    state.isLoggedIn = true;
    localStorage.setItem(LS_LOGGED, 'true');
    nav('dashboard');
}

function doLogout() {
    state.isLoggedIn = false;
    localStorage.setItem(LS_LOGGED, 'false');
    document.getElementById('bottom-nav').style.display = 'none';
    showScreen('welcome');
}

// --- UTILITÁRIOS ---
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(y, m - 1, d);
}

function formatCurrency(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

// --- MOTOR DE PREVISÃO CONTÍNUA ---
// Calcula o fluxo de caixa dia a dia até meses no futuro
function getDailyData() {
    let allEvents = [...state.transactions];
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    // Janela de análise: de hoje até +180 dias
    let startDate = new Date(today);
    startDate.setDate(today.getDate() - 365); // Começa análise 1 ano atrás para pegar histórico completo

    let endDate = new Date(today.getFullYear() + 1, 11, 31); // Todo o próximo ano completo

    // Projeta recorrências no período futuro
    state.recurrences.forEach(r => {
        if (r.type === 'installment') {
            let d = parseDate(r.startDate);
            let count = 1;
            while (d <= endDate && count <= r.totalInstallments) {
                allEvents.push({
                    id: r.id + '_' + count,
                    desc: `${r.desc} (${count}/${r.totalInstallments})`,
                    value: Number(r.value),
                    date: formatDate(d),
                    isRecurrence: true
                });
                d.setMonth(d.getMonth() + 1);
                count++;
            }
        } else {
            let d = new Date(today);
            d.setDate(r.day);
            if (d < today) d.setMonth(d.getMonth() + 1); // próxima ocorrência se o dia já passou

            while (d <= endDate) {
                allEvents.push({
                    id: r.id + '_' + d.getTime(),
                    desc: r.desc,
                    value: Number(r.value),
                    date: formatDate(d),
                    isRecurrence: true
                });
                d.setMonth(d.getMonth() + 1);
            }
        }
    });

    // Agrupa por data
    let eventsByDate = {};
    allEvents.forEach(e => {
        if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
        eventsByDate[e.date].push(e);
    });

    // Encontra a primeira data para começar o cálculo do saldo acumulado
    let absoluteMinStr = allEvents.reduce((min, e) => e.date < min ? e.date : min, formatDate(today));
    let currentDate = parseDate(absoluteMinStr);
    let balance = 0;
    let dailyData = {};

    // Calcula dia a dia
    while (currentDate <= endDate) {
        let dStr = formatDate(currentDate);
        let dayEvents = eventsByDate[dStr] || [];
        let daySum = dayEvents.reduce((sum, e) => sum + Number(e.value), 0);

        balance += daySum;
        dailyData[dStr] = {
            date: dStr,
            balance: balance,
            events: dayEvents
        };
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Regra Inteligente de Cores (Foco no Futuro)
    let dates = Object.keys(dailyData).sort();
    dates.forEach((dStr, idx) => {
        let b = dailyData[dStr].balance;
        let color = 'green';

        if (b < 0) {
            color = 'red'; // Negativo no momento
        } else {
            // Analisa os próximos 30 dias para prever aperto
            let minFuture = b;
            for (let i = 1; i <= 30; i++) {
                if (idx + i < dates.length) {
                    let futureB = dailyData[dates[idx + i]].balance;
                    if (futureB < minFuture) minFuture = futureB;
                }
            }
            if (minFuture < 0) {
                color = 'yellow'; // Vai ficar negativo
            } else if (minFuture < 300) {
                color = 'yellow'; // Margem apertada (< R$ 300)
            }
        }
        dailyData[dStr].color = color;
    });

    return dailyData;
}

// --- RENDERIZADORES DE TELA ---

function renderDashboard() {
    let daily = getDailyData();
    let todayStr = formatDate(new Date());

    let futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    let futureStr = formatDate(futureDate);

    let todayData = daily[todayStr] || { balance: 0, color: 'green' };
    let futureData = daily[futureStr] || { balance: todayData.balance };

    document.getElementById('dash-current-balance').innerText = formatCurrency(todayData.balance);
    document.getElementById('dash-future-balance').innerText = formatCurrency(futureData.balance);

    let badge = document.getElementById('dash-status-badge');
    badge.className = `status-badge ${todayData.color}`;
    if (todayData.color === 'green') badge.innerText = 'Tranquilo';
    if (todayData.color === 'yellow') badge.innerText = 'Atenção';
    if (todayData.color === 'red') badge.innerText = 'Crítico';

    // Previsão Contínua no Dashboard
    let listEl = document.getElementById('dash-forecast-timeline');
    if (listEl) {
        listEl.innerHTML = '';
        let dates = Object.keys(daily).filter(d => d >= todayStr).sort();

        dates.forEach(dStr => {
            let data = daily[dStr];
            let [y, m, d] = dStr.split('-');

            let div = document.createElement('div');
            div.className = `timeline-day border-${data.color}`;

            let eventsHtml = data.events.length > 0 ? data.events.map(e => {
                let isNeg = e.value < 0;
                return `<div class="timeline-event ${isNeg ? 'text-red' : 'text-green'}">
                    <span>${e.desc} ${e.isSimulation ? '<b>(Simulação)</b>' : ''}</span>
                    <span>${formatCurrency(e.value)}</span>
                </div>`;
            }).join('') : '<div class="timeline-event text-muted" style="color: #999; font-size: 12px;">Sem movimentações</div>';

            div.innerHTML = `
                <div class="timeline-header">
                    <div class="timeline-date">${d}/${m}/${y}</div>
                    <div class="timeline-balance text-${data.color}">${formatCurrency(data.balance)}</div>
                </div>
                <div class="timeline-events">
                    ${eventsHtml}
                </div>
            `;
            listEl.appendChild(div);
        });
    }
}

function renderDiary() {
    let listEl = document.getElementById('diary-list');
    listEl.innerHTML = '';
    let sorted = [...state.transactions].sort((a, b) => a.date > b.date ? -1 : 1);

    if (sorted.length === 0) listEl.innerHTML = '<p class="empty-msg">Nenhuma movimentação registrada.</p>';

    sorted.forEach(t => {
        listEl.appendChild(createEventCard(t, t.date));
    });
}

function renderForecast() {
    let daily = getDailyData();
    let todayStr = formatDate(new Date());
    let dates = Object.keys(daily).filter(d => d >= todayStr).sort();

    let listEl = document.getElementById('forecast-timeline');
    listEl.innerHTML = '';

    dates.forEach(dStr => {
        let data = daily[dStr];
        let [y, m, d] = dStr.split('-');

        let div = document.createElement('div');
        div.className = `timeline-day border-${data.color}`;

        let eventsHtml = data.events.length > 0 ? data.events.map(e => {
            let isNeg = e.value < 0;
            return `<div class="timeline-event ${isNeg ? 'text-red' : 'text-green'}">
                <span>${e.desc} ${e.isSimulation ? '<b>(Simulação)</b>' : ''}</span>
                <span>${formatCurrency(e.value)}</span>
            </div>`;
        }).join('') : '<div class="timeline-event text-muted" style="color: #999; font-size: 12px;">Sem movimentações</div>';

        div.innerHTML = `
            <div class="timeline-header">
                <div class="timeline-date">${d}/${m}/${y}</div>
                <div class="timeline-balance text-${data.color}">${formatCurrency(data.balance)}</div>
            </div>
            <div class="timeline-events">
                ${eventsHtml}
            </div>
        `;
        listEl.appendChild(div);
    });
}

function renderRecurrences() {

    let listEl = document.getElementById('recurrences-list');
    listEl.innerHTML = '';

    if (state.recurrences.length === 0) {
        listEl.innerHTML = '<p class="empty-msg">Nenhuma conta fixa cadastrada.</p>';
        return;
    }

    // Ordena contas fixas e parceladas
    let sorted = [...state.recurrences].sort((a, b) => {

        let dayA = 1;
        let dayB = 1;

        if (a.type === 'installment') {
            dayA = parseDate(a.startDate).getDate();
        } else {
            dayA = a.day || 1;
        }

        if (b.type === 'installment') {
            dayB = parseDate(b.startDate).getDate();
        } else {
            dayB = b.day || 1;
        }

        return dayA - dayB;
    });

    sorted.forEach(r => {

        let div = document.createElement('div');
        div.className = 'event-card';

        let isNeg = Number(r.value) < 0;

        let desc = r.desc;
        let info = '';

        // Parcelado
        if (r.type === 'installment') {

            desc = `${r.desc} (${r.totalInstallments}x)`;

            let d = parseDate(r.startDate);

            let dia = String(d.getDate()).padStart(2, '0');
            let mes = String(d.getMonth() + 1).padStart(2, '0');
            let ano = d.getFullYear();

            info = `Início: ${dia}/${mes}/${ano}`;
        }

        // Conta fixa mensal (nova ou antiga)
        else {

            let dia = String(r.day || 1).padStart(2, '0');

            info = `Todo dia ${dia}`;
        }

        div.innerHTML = `
            <div class="event-icon ${isNeg ? 'bg-red-light text-red' : 'bg-green-light text-green'}">
                <i class="fas fa-sync"></i>
            </div>

            <div class="event-details">
                <div class="event-desc">${desc}</div>
                <div class="event-date">${info}</div>
            </div>

            <div class="event-value ${isNeg ? 'text-red' : 'text-green'}">
                ${formatCurrency(r.value)}
            </div>

            <button class="btn-del" onclick="deleteRecurrence('${r.id}')">
                <i class="fas fa-trash"></i>
            </button>
        `;

        listEl.appendChild(div);
    });
}

// Cria DOM para um evento avulso ou recorrência listada
function createEventCard(e, dateStr) {
    let div = document.createElement('div');
    div.className = 'event-card';
    let isNeg = e.value < 0;

    let simBadge = e.isSimulation ? '<span class="badge sim">Simulação</span>' : '';
    let recBadge = e.isRecurrence ? '<span class="badge rec">Fixo</span>' : '';
    let [y, m, d] = dateStr.split('-');

    div.innerHTML = `
        <div class="event-icon ${isNeg ? 'bg-red-light text-red' : 'bg-green-light text-green'}">
            <i class="fas ${isNeg ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
        </div>
        <div class="event-details">
            <div class="event-desc">${e.desc} ${simBadge} ${recBadge}</div>
            <div class="event-date">${d}/${m}/${y}</div>
        </div>
        <div class="event-value ${isNeg ? 'text-red' : 'text-green'}">
            ${formatCurrency(e.value)}
        </div>
        ${(e.isSimulation || !e.isRecurrence) ? `<button class="btn-del" onclick="deleteTx('${e.id}')"><i class="fas fa-trash"></i></button>` : ''}
    `;
    return div;
}

// --- MODAIS E AÇÕES ---

function openModal(type) {
    document.getElementById('event-modal').style.display = 'flex';
    document.getElementById('modal-type').value = type;
    document.getElementById('modal-value').value = '';
    document.getElementById('modal-desc').value = '';
    document.getElementById('modal-date').value = formatDate(new Date());
    document.getElementById('modal-day').value = '';
    if (document.getElementById('modal-installments')) {
        document.getElementById('modal-installments').value = '';
    }

    let radios = document.getElementsByName('rec_type');
    if (radios.length > 0) radios[0].checked = true;

    let title = 'Nova Movimentação';
    let isRec = type.startsWith('recurrence');

    if (document.getElementById('modal-rec-type-wrapper')) {
        document.getElementById('modal-rec-type-wrapper').style.display = isRec ? 'block' : 'none';
    }

    if (type === 'income') title = 'Nova Entrada';
    if (type === 'expense') title = 'Nova Saída';
    if (type === 'simulation') title = 'Simular Gasto Futuro';
    if (type === 'recurrence_income') title = 'Nova Receita Fixa';
    if (type === 'recurrence_expense') title = 'Nova Despesa Fixa';

    document.getElementById('modal-title').innerText = title;

    if (typeof toggleRecType === 'function') toggleRecType();
}

function toggleRecType() {
    let type = document.getElementById('modal-type').value;
    let isRec = type.startsWith('recurrence');

    let recType = 'monthly';
    document.getElementsByName('rec_type').forEach(r => {
        if (r.checked) recType = r.value;
    });

    let isInstallment = isRec && recType === 'installment';

    if (document.getElementById('modal-installments-wrapper')) {
        document.getElementById('modal-installments-wrapper').style.display = isInstallment ? 'block' : 'none';
    }

    if (isInstallment) {
        document.getElementById('modal-day-wrapper').style.display = 'none';
        document.getElementById('modal-date-wrapper').style.display = 'block';
        document.getElementById('modal-date-label').innerText = 'Data da 1ª Parcela';
        document.getElementById('modal-value-label').innerText = 'Valor Total (R$)';
    } else if (isRec) {
        document.getElementById('modal-day-wrapper').style.display = 'block';
        document.getElementById('modal-date-wrapper').style.display = 'none';
        document.getElementById('modal-value-label').innerText = 'Valor (R$)';
    } else {
        document.getElementById('modal-day-wrapper').style.display = 'none';
        document.getElementById('modal-date-wrapper').style.display = 'block';
        document.getElementById('modal-date-label').innerText = 'Data';
        document.getElementById('modal-value-label').innerText = 'Valor (R$)';
    }
}

function closeModal() {
    document.getElementById('event-modal').style.display = 'none';
}

function saveEvent() {
    let type = document.getElementById('modal-type').value;
    let value = parseFloat(document.getElementById('modal-value').value) || 0;
    let desc = document.getElementById('modal-desc').value || (type.includes('income') ? 'Entrada' : 'Saída');

    if (type === 'expense' || type === 'simulation' || type === 'recurrence_expense') {
        value = -Math.abs(value);
    } else {
        value = Math.abs(value);
    }

    let isRec = type.startsWith('recurrence');
    let recType = 'monthly';
    if (isRec) {
        document.getElementsByName('rec_type').forEach(r => {
            if (r.checked) recType = r.value;
        });
    }

    if (isRec) {
        if (recType === 'installment') {
            let totalInst = parseInt(document.getElementById('modal-installments').value) || 2;
            let startDate = document.getElementById('modal-date').value;
            let installmentValue = value / totalInst;
            state.recurrences.push({
                id: generateId(),
                desc,
                value: installmentValue,
                type: 'installment',
                totalInstallments: totalInst,
                startDate
            });
        } else {
            let day = parseInt(document.getElementById('modal-day').value) || 1;
            state.recurrences.push({ id: generateId(), desc, value, day, type: 'monthly' });
        }
    } else {
        let date = document.getElementById('modal-date').value;
        let isSimulation = type === 'simulation';
        state.transactions.push({ id: generateId(), desc, value, date, isSimulation });
    }

    saveData();
    closeModal();

    let activeScreen = document.querySelector('.screen.active');
    if (activeScreen) updateViewData(activeScreen.id.replace('screen-', ''));
}

function deleteTx(id) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveData();
    let activeScreen = document.querySelector('.screen.active');
    if (activeScreen) updateViewData(activeScreen.id.replace('screen-', ''));
}

function deleteRecurrence(id) {
    state.recurrences = state.recurrences.filter(r => r.id !== id);
    saveData();
    let activeScreen = document.querySelector('.screen.active');
    if (activeScreen) updateViewData(activeScreen.id.replace('screen-', ''));
}
