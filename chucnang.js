// =============================
// 1. ĐỒNG HỒ
// =============================
function updateClock() {
    const now = new Date();
    document.getElementById('time').innerText = now.toLocaleTimeString('vi-VN', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// =============================
// 2. FIREBASE
// =============================
const db = firebase.database();

let currentFloor = 'tang_1';
let currentRoom = 'lop_1';

let sensorsRef = null;
let controlsRef = null;
let thresholdRef = null;
let myChart = null;
let sensorSliderTimer = null;
let isUserSlidingSensor = false;

const DEFAULT_SENSORS = {
    nhiet_do: 25,
    do_am: 60,
    bui_min: 60
};

const DEFAULT_CONTROLS = {
    power_main: 0,
    mode_auto: 0,
    ac: 0,
    fan: 0,
    light: 0,
    purifier: 0
};

const DEFAULT_THRESHOLDS = {
    nhiet_max: 22,
    do_am_max: 80,
    bui_max: 50
};

// Tài khoản demo đăng nhập theo từng tầng/lớp.
const SESSION_KEY = 'smart_classroom_logged_account';
const CLASS_ACCOUNTS = {
    tang1lop1: { password: '1111', floor: 'tang_1', room: 'lop_1', label: 'Tầng 1 - Lớp 1' },
    tang1lop2: { password: '2222', floor: 'tang_1', room: 'lop_2', label: 'Tầng 1 - Lớp 2' },
    tang1lop3: { password: '3333', floor: 'tang_1', room: 'lop_3', label: 'Tầng 1 - Lớp 3' },
    tang2lop1: { password: '4444', floor: 'tang_2', room: 'lop_1', label: 'Tầng 2 - Lớp 1' },
    tang2lop2: { password: '5555', floor: 'tang_2', room: 'lop_2', label: 'Tầng 2 - Lớp 2' },
    tang2lop3: { password: '6666', floor: 'tang_2', room: 'lop_3', label: 'Tầng 2 - Lớp 3' }
};

let loggedAccountKey = null;

// =============================
// 3. DOM
// =============================
const tempVal = document.getElementById('temp-val');
const humVal = document.getElementById('hum-val');
const dustVal = document.getElementById('dust-val');

const sliderTemp = document.getElementById('slider-temp');
const sliderHum = document.getElementById('slider-hum');
const sliderDust = document.getElementById('slider-dust');

const sliderTempValue = document.getElementById('slider-temp-value');
const sliderHumValue = document.getElementById('slider-hum-value');
const sliderDustValue = document.getElementById('slider-dust-value');

const thresholdTempText = document.getElementById('threshold-temp-text');
const thresholdHumText = document.getElementById('threshold-hum-text');
const thresholdDustText = document.getElementById('threshold-dust-text');

const terminalLog = document.getElementById('terminal-log');

const modeStatus = document.getElementById('mode-status');

const btnPower = document.getElementById('btn-power');
const btnMode = document.getElementById('btn-mode');
const btnAc = document.getElementById('btn-ac');
const btnFan = document.getElementById('btn-fan');
const btnLight = document.getElementById('btn-light');
const btnPurifier = document.getElementById('btn-purifier');

const imgPower = document.getElementById('img-power');
const imgMode = document.getElementById('img-mode');
const imgAc = document.getElementById('img-ac');
const imgFan = document.getElementById('img-fan');
const imgLight = document.getElementById('img-light');
const imgPurifier = document.getElementById('img-purifier');

const deviceBtns = [btnAc, btnFan, btnLight, btnPurifier];

const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const rememberLogin = document.getElementById('remember-login');
const loginMessage = document.getElementById('login-message');
const btnLogout = document.getElementById('btn-logout');
const loginRoomLabel = document.getElementById('login-room-label');
const selectFloor = document.getElementById('select-floor');
const selectRoom = document.getElementById('select-room');

// =============================
// 4. STATE
// =============================
let currentState = {
    power_main: 0,
    mode_auto: 0,

    temp: 25,
    hum: 60,
    dust: 60,

    ac: 0,
    fan: 0,
    light: 0,
    purifier: 0,

    nhiet_max: 22,
    do_am_max: 80,
    bui_max: 50
};

let thresholdStatus = {
    tempHigh: false,
    humHigh: false,
    dustHigh: false
};

// =============================
// 5. HÀM TIỆN ÍCH
// =============================
function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toBinary(value) {
    return Number(value) === 1 ? 1 : 0;
}

function safeLocalStorageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

function safeLocalStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
    }
}

function safeLocalStorageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
    }
}

function setLoginMessage(message, type = 'error') {
    if (!loginMessage) return;
    loginMessage.textContent = message;
    loginMessage.className = `login-message ${type}`;
}

function stopFirebaseListeners() {
    if (sensorsRef) sensorsRef.off();
    if (controlsRef) controlsRef.off();
    if (thresholdRef) thresholdRef.off();

    sensorsRef = null;
    controlsRef = null;
    thresholdRef = null;
}

function lockRoomSelector(isLocked) {
    selectFloor.disabled = isLocked;
    selectRoom.disabled = isLocked;
}

function clearTerminalLog() {
    terminalLog.innerHTML = '<div class="terminal-line info">[Hệ thống] Giao diện web Smart Classroom đã khởi động.</div>';
}

function applyLogin(accountKey, remember = true) {
    const account = CLASS_ACCOUNTS[accountKey];
    if (!account) return;

    loggedAccountKey = accountKey;
    currentFloor = account.floor;
    currentRoom = account.room;

    selectFloor.value = currentFloor;
    selectRoom.value = currentRoom;
    lockRoomSelector(true);

    loginRoomLabel.textContent = account.label;
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('app-hidden');

    if (remember) {
        safeLocalStorageSet(SESSION_KEY, accountKey);
    } else {
        safeLocalStorageRemove(SESSION_KEY);
    }

    clearTerminalLog();
    renderSensors();
    renderSensorSliders();
    renderThresholds();
    updateChart();
    loadRoomData();
    addTerminalLog(`Đăng nhập thành công: ${account.label}.`, 'ok');
}

function handleLoginSubmit(event) {
    event.preventDefault();

    const username = loginUsername.value.trim().toLowerCase();
    const password = loginPassword.value.trim();
    const account = CLASS_ACCOUNTS[username];

    if (!account || account.password !== password) {
        setLoginMessage('Sai tài khoản hoặc mật khẩu. Vui lòng kiểm tra lại.', 'error');
        loginPassword.value = '';
        loginPassword.focus();
        return;
    }

    setLoginMessage('Đăng nhập thành công.', 'success');
    applyLogin(username, rememberLogin.checked);
}

function handleLogout() {
    stopFirebaseListeners();
    safeLocalStorageRemove(SESSION_KEY);

    loggedAccountKey = null;
    currentFloor = 'tang_1';
    currentRoom = 'lop_1';

    selectFloor.value = currentFloor;
    selectRoom.value = currentRoom;
    lockRoomSelector(false);

    appContainer.classList.add('app-hidden');
    loginScreen.classList.remove('hidden');
    loginRoomLabel.textContent = 'Chưa đăng nhập';

    loginUsername.value = '';
    loginPassword.value = '';
    setLoginMessage('Bạn đã đăng xuất.', 'success');
    loginUsername.focus();
}

function initLogin() {
    loginForm.addEventListener('submit', handleLoginSubmit);
    btnLogout.addEventListener('click', handleLogout);

    const savedAccountKey = safeLocalStorageGet(SESSION_KEY);
    if (savedAccountKey && CLASS_ACCOUNTS[savedAccountKey]) {
        applyLogin(savedAccountKey, true);
    } else {
        loginScreen.classList.remove('hidden');
        appContainer.classList.add('app-hidden');
        lockRoomSelector(false);
    }
}

// Tự bổ sung key còn thiếu trong Firebase.
// Có hỗ trợ key cũ: do_bui -> bui_min, air -> purifier.
function ensureNodeDefaults(ref, defaults, aliases = {}) {
    ref.once('value', (snapshot) => {
        const data = snapshot.val() || {};
        const updates = {};

        Object.keys(defaults).forEach((key) => {
            if (data[key] === undefined || data[key] === null) {
                const aliasList = aliases[key] || [];
                let foundAliasValue = false;

                for (const aliasKey of aliasList) {
                    if (data[aliasKey] !== undefined && data[aliasKey] !== null) {
                        updates[key] = data[aliasKey];
                        foundAliasValue = true;
                        break;
                    }
                }

                if (!foundAliasValue) {
                    updates[key] = defaults[key];
                }
            }
        });

        if (Object.keys(updates).length > 0) {
            ref.update(updates);
        }
    });
}

// =============================
// 6. KHUNG NHẬT KÝ HỆ THỐNG
// =============================
function getCurrentTimeString() {
    return new Date().toLocaleTimeString('vi-VN', { hour12: false });
}

function addTerminalLog(message, type = 'info') {
    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    line.textContent = `[${getCurrentTimeString()}] ${message}`;
    terminalLog.appendChild(line);
    terminalLog.scrollTop = terminalLog.scrollHeight;

    const maxLines = 60;
    while (terminalLog.children.length > maxLines) {
        terminalLog.removeChild(terminalLog.firstChild);
    }
}

function checkThresholdAlerts() {
    const tempHighNow = currentState.temp >= currentState.nhiet_max;
    const humHighNow = currentState.hum >= currentState.do_am_max;
    const dustHighNow = currentState.dust >= currentState.bui_max;

    if (tempHighNow && !thresholdStatus.tempHigh) {
        addTerminalLog(`Cảnh báo: Nhiệt độ vượt ngưỡng (${currentState.temp.toFixed(1)}°C / ngưỡng ${currentState.nhiet_max}°C).`, 'alert');
    } else if (!tempHighNow && thresholdStatus.tempHigh) {
        addTerminalLog(`Nhiệt độ đã trở lại bình thường (${currentState.temp.toFixed(1)}°C).`, 'ok');
    }

    if (humHighNow && !thresholdStatus.humHigh) {
        addTerminalLog(`Cảnh báo: Độ ẩm vượt ngưỡng (${Math.round(currentState.hum)}% / ngưỡng ${currentState.do_am_max}%).`, 'warn');
    } else if (!humHighNow && thresholdStatus.humHigh) {
        addTerminalLog(`Độ ẩm đã trở lại bình thường (${Math.round(currentState.hum)}%).`, 'ok');
    }

    if (dustHighNow && !thresholdStatus.dustHigh) {
        addTerminalLog(`Cảnh báo: Bụi mịn PM2.5 vượt ngưỡng (${Math.round(currentState.dust)} µg/m³ / ngưỡng ${currentState.bui_max} µg/m³).`, 'alert');
    } else if (!dustHighNow && thresholdStatus.dustHigh) {
        addTerminalLog(`Bụi mịn PM2.5 đã trở lại bình thường (${Math.round(currentState.dust)} µg/m³).`, 'ok');
    }

    thresholdStatus.tempHigh = tempHighNow;
    thresholdStatus.humHigh = humHighNow;
    thresholdStatus.dustHigh = dustHighNow;
}

// =============================
// 7. RENDER
// =============================
function renderSensors() {
    tempVal.innerText = `${Number(currentState.temp).toFixed(1)} °C`;
    humVal.innerText = `${Math.round(currentState.hum)} %`;
    dustVal.innerText = `${Math.round(currentState.dust)} µg/m³`;
}

function renderSensorSliders() {
    sliderTemp.value = currentState.temp;
    sliderHum.value = currentState.hum;
    sliderDust.value = currentState.dust;

    sliderTempValue.innerText = `${Number(currentState.temp).toFixed(1)} °C`;
    sliderHumValue.innerText = `${Math.round(currentState.hum)} %`;
    sliderDustValue.innerText = `${Math.round(currentState.dust)} µg/m³`;
}

function renderThresholds() {
    thresholdTempText.innerText = `Ngưỡng: ${currentState.nhiet_max} °C`;
    thresholdHumText.innerText = `Ngưỡng: ${currentState.do_am_max} %`;
    thresholdDustText.innerText = `Ngưỡng: ${currentState.bui_max} µg/m³`;
}

// =============================
// 8. LOAD DATA
// =============================
function loadRoomData() {
    if (sensorsRef) sensorsRef.off();
    if (controlsRef) controlsRef.off();
    if (thresholdRef) thresholdRef.off();

    sensorsRef = db.ref(`building/${currentFloor}/${currentRoom}/sensors`);
    controlsRef = db.ref(`building/${currentFloor}/${currentRoom}/controls`);
    thresholdRef = db.ref(`building/${currentFloor}/${currentRoom}/thresholds`);
    thresholdStatus = {
        tempHigh: false,
        humHigh: false,
        dustHigh: false
    };

    addTerminalLog(`Đã chuyển sang ${currentFloor.replace('_', ' ')} - ${currentRoom.replace('_', ' ')}.`, 'info');

    ensureNodeDefaults(sensorsRef, DEFAULT_SENSORS, {
        bui_min: ['do_bui']
    });

    ensureNodeDefaults(controlsRef, DEFAULT_CONTROLS, {
        purifier: ['air']
    });

    ensureNodeDefaults(thresholdRef, DEFAULT_THRESHOLDS);

    thresholdRef.on('value', (snapshot) => {
        const thresh = snapshot.val() || {};

        currentState.nhiet_max = toNumber(thresh.nhiet_max, DEFAULT_THRESHOLDS.nhiet_max);
        currentState.do_am_max = toNumber(thresh.do_am_max, DEFAULT_THRESHOLDS.do_am_max);
        currentState.bui_max = toNumber(thresh.bui_max, DEFAULT_THRESHOLDS.bui_max);

        renderThresholds();
        checkThresholdAlerts();
        handleAutoModeLogic();
    });

    sensorsRef.on('value', (snapshot) => {
        const data = snapshot.val() || {};
        const dustRaw = data.bui_min !== undefined ? data.bui_min : data.do_bui;

        currentState.temp = toNumber(data.nhiet_do, DEFAULT_SENSORS.nhiet_do);
        currentState.hum = toNumber(data.do_am, DEFAULT_SENSORS.do_am);
        currentState.dust = toNumber(dustRaw, DEFAULT_SENSORS.bui_min);

        renderSensors();

        if (!isUserSlidingSensor) {
            renderSensorSliders();
        }

        updateChart();
        checkThresholdAlerts();
        handleAutoModeLogic();
    });

    controlsRef.on('value', (snapshot) => {
        const controls = snapshot.val() || {};
        const purifierRaw = controls.purifier !== undefined ? controls.purifier : controls.air;

        currentState.power_main = toBinary(controls.power_main);
        currentState.mode_auto = toBinary(controls.mode_auto);
        currentState.ac = toBinary(controls.ac);
        currentState.fan = toBinary(controls.fan);
        currentState.light = toBinary(controls.light);
        currentState.purifier = toBinary(purifierRaw);

        renderControls();
        updateUIState();
    });
}

// =============================
// 9. SLIDER UPDATE
// =============================
function updateSensorSliderTextOnly() {
    const temp = parseFloat(sliderTemp.value);
    const hum = parseFloat(sliderHum.value);
    const dust = parseFloat(sliderDust.value);

    sliderTempValue.innerText = `${temp.toFixed(1)} °C`;
    sliderHumValue.innerText = `${Math.round(hum)} %`;
    sliderDustValue.innerText = `${Math.round(dust)} µg/m³`;
}

function updateSensorsToFirebase() {
    if (!sensorsRef) return;

    const temp = parseFloat(sliderTemp.value);
    const hum = parseFloat(sliderHum.value);
    const dust = parseFloat(sliderDust.value);

    sensorsRef.update({
        nhiet_do: temp,
        do_am: hum,
        bui_min: dust
    }).then(() => {
        setTimeout(() => {
            isUserSlidingSensor = false;
        }, 120);
    });
}

function handleSensorSliderInput() {
    isUserSlidingSensor = true;
    updateSensorSliderTextOnly();

    clearTimeout(sensorSliderTimer);
    sensorSliderTimer = setTimeout(() => {
        updateSensorsToFirebase();
    }, 150);
}

sliderTemp.addEventListener('input', handleSensorSliderInput);
sliderHum.addEventListener('input', handleSensorSliderInput);
sliderDust.addEventListener('input', handleSensorSliderInput);

sliderTemp.addEventListener('change', updateSensorsToFirebase);
sliderHum.addEventListener('change', updateSensorsToFirebase);
sliderDust.addEventListener('change', updateSensorsToFirebase);

// =============================
// 10. SELECT ROOM
// =============================
selectFloor.addEventListener('change', (e) => {
    if (!loggedAccountKey) return;
    currentFloor = e.target.value;
    loadRoomData();
});

selectRoom.addEventListener('change', (e) => {
    if (!loggedAccountKey) return;
    currentRoom = e.target.value;
    loadRoomData();
});

// =============================
// 11. BUTTON EVENTS
// =============================
btnPower.addEventListener('change', (e) => {
    if (!controlsRef) return;
    const state = e.target.checked ? 1 : 0;
    controlsRef.update({ power_main: state });

    addTerminalLog(state === 1 ? 'Nguồn tổng đã BẬT.' : 'Nguồn tổng đã TẮT.', 'info');

    if (state === 0) {
        controlsRef.update({
            mode_auto: 0,
            ac: 0,
            fan: 0,
            light: 0,
            purifier: 0
        });
    }
});

btnMode.addEventListener('change', (e) => {
    if (!controlsRef) return;
    const state = e.target.checked ? 1 : 0;
    controlsRef.update({ mode_auto: state });

    addTerminalLog(state === 1 ? 'Đã chuyển sang chế độ TỰ ĐỘNG.' : 'Đã chuyển sang chế độ THỦ CÔNG.', 'info');

    if (state === 1) {
        handleAutoModeLogic();
    }
});

btnAc.addEventListener('change', (e) => {
    if (!controlsRef) return;
    controlsRef.update({ ac: e.target.checked ? 1 : 0 });
    addTerminalLog(`Máy lạnh ${e.target.checked ? 'đã BẬT' : 'đã TẮT'}.`, 'info');
});

btnFan.addEventListener('change', (e) => {
    if (!controlsRef) return;
    controlsRef.update({ fan: e.target.checked ? 1 : 0 });
    addTerminalLog(`Quạt máy ${e.target.checked ? 'đã BẬT' : 'đã TẮT'}.`, 'info');
});

btnLight.addEventListener('change', (e) => {
    if (!controlsRef) return;
    controlsRef.update({ light: e.target.checked ? 1 : 0 });
    addTerminalLog(`Đèn phòng ${e.target.checked ? 'đã BẬT' : 'đã TẮT'}.`, 'info');
});

btnPurifier.addEventListener('change', (e) => {
    if (!controlsRef) return;
    controlsRef.update({ purifier: e.target.checked ? 1 : 0 });
    addTerminalLog(`Máy lọc bụi ${e.target.checked ? 'đã BẬT' : 'đã TẮT'}.`, 'info');
});

// =============================
// 12. RENDER CONTROLS
// =============================
function renderControls() {
    btnPower.checked = currentState.power_main === 1;
    btnMode.checked = currentState.mode_auto === 1;
    btnAc.checked = currentState.ac === 1;
    btnFan.checked = currentState.fan === 1;
    btnLight.checked = currentState.light === 1;
    btnPurifier.checked = currentState.purifier === 1;

    imgPower.src = currentState.power_main === 1 ? "image/power_on.png" : "image/power_off.png";
    imgMode.src = currentState.mode_auto === 1 ? "image/mode_auto.png" : "image/mode_manual.png";
    imgAc.src = currentState.ac === 1 ? "image/ac_on.png" : "image/ac_off.png";
    imgFan.src = currentState.fan === 1 ? "image/quat_on.png" : "image/quat_off.png";
    imgLight.src = currentState.light === 1 ? "image/batden.png" : "image/tatden.png";
    imgPurifier.src = currentState.purifier === 1 ? "image/purifier_on.png" : "image/purifier_off.png";

    modeStatus.innerText = currentState.mode_auto === 1
        ? "Đang chọn: Tự động"
        : "Đang chọn: Thủ công";
}

// =============================
// 13. UI STATE
// =============================
function updateUIState() {
    if (currentState.power_main === 0) {
        btnMode.disabled = true;
        deviceBtns.forEach(btn => btn.disabled = true);
        return;
    }

    btnMode.disabled = false;
    btnLight.disabled = false;

    if (currentState.mode_auto === 1) {
        btnAc.disabled = true;
        btnFan.disabled = true;
        btnPurifier.disabled = true;
    } else {
        btnAc.disabled = false;
        btnFan.disabled = false;
        btnPurifier.disabled = false;
    }
}

// =============================
// 14. AUTO LOGIC
// =============================
function handleAutoModeLogic() {
    if (!controlsRef) return;
    if (currentState.power_main !== 1) return;
    if (currentState.mode_auto !== 1) return;

    const updates = {};

    if (currentState.temp >= currentState.nhiet_max) {
        if (currentState.ac !== 1) {
            updates.ac = 1;
            addTerminalLog('Tự động: Bật máy lạnh do nhiệt độ vượt ngưỡng.', 'warn');
        }
        if (currentState.fan !== 0) {
            updates.fan = 0;
            addTerminalLog('Tự động: Tắt quạt do đang ưu tiên máy lạnh.', 'warn');
        }
    } else {
        if (currentState.ac !== 0) {
            updates.ac = 0;
            addTerminalLog('Tự động: Tắt máy lạnh vì nhiệt độ đã dưới ngưỡng.', 'ok');
        }
        if (currentState.fan !== 1) {
            updates.fan = 1;
            addTerminalLog('Tự động: Bật quạt do nhiệt độ ở mức bình thường.', 'ok');
        }
    }
    if (currentState.dust >= currentState.bui_max) {
        if (currentState.purifier !== 1) {
            updates.purifier = 1;
            addTerminalLog('Tự động: Bật máy lọc bụi do bụi mịn vượt ngưỡng.', 'warn');
        }
    } else {
        if (currentState.purifier !== 0) {
            updates.purifier = 0;
            addTerminalLog('Tự động: Tắt máy lọc bụi vì bụi mịn đã bình thường.', 'ok');
        }
    }

    if (Object.keys(updates).length > 0) {
        controlsRef.update(updates);
    }
}

// =============================
// 15. CHART
// =============================
function updateChart() {
    const canvas = document.getElementById('myChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const dataChart = [
        Number(currentState.temp) || 0,
        Number(currentState.hum) || 0,
        Number(currentState.dust) || 0
    ];

    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Nhiệt độ (°C)', 'Độ ẩm (%)', 'Bụi mịn PM2.5'],
            datasets: [{
                data: dataChart,
                backgroundColor: [
                    'rgba(231, 74, 59, 0.85)',
                    'rgba(78, 115, 223, 0.85)',
                    'rgba(246, 194, 62, 0.9)'
                ],
                borderColor: [
                    '#e74a3b',
                    '#4e73df',
                    '#f6c23e'
                ],
                borderWidth: 1,
                borderRadius: 8,
                barPercentage: 0.55,
                categoryPercentage: 0.65
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const value = context.raw;

                            if (index === 0) return `Nhiệt độ: ${value} °C`;
                            if (index === 1) return `Độ ẩm: ${value} %`;
                            if (index === 2) return `Bụi mịn: ${value} µg/m³`;
                            return value;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, weight: 'bold' }
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 300,
                    title: {
                        display: true,
                        text: 'Giá trị đo được'
                    },
                    ticks: {
                        stepSize: 50
                    }
                }
            }
        }
    });
}

// =============================
// 16. INIT
// =============================
renderSensors();
renderSensorSliders();
renderThresholds();
initLogin();
