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
// 5. TERMINAL
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
// 6. RENDER
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
// 7. LOAD DATA
// =============================
function loadRoomData() {
    if (sensorsRef) sensorsRef.off();
    if (controlsRef) controlsRef.off();
    if (thresholdRef) thresholdRef.off();

    sensorsRef = db.ref(`building/${currentFloor}/${currentRoom}/sensors`);
    controlsRef = db.ref(`building/${currentFloor}/${currentRoom}/controls`);
    thresholdRef = db.ref(`building/${currentFloor}/${currentRoom}/thresholds`);

    addTerminalLog(`Đã chuyển sang ${currentFloor.replace('_', ' ')} - ${currentRoom.replace('_', ' ')}.`, 'info');

    sensorsRef.once('value', (snapshot) => {
        if (!snapshot.exists()) {
            sensorsRef.set({
                nhiet_do: 25,
                do_am: 60,
                bui_min: 60
            });
        }
    });

    controlsRef.once('value', (snapshot) => {
        if (!snapshot.exists()) {
            controlsRef.set({
                power_main: 0,
                mode_auto: 0,
                ac: 0,
                fan: 0,
                light: 0,
                purifier: 0
            });
        }
    });

    thresholdRef.once('value', (snapshot) => {
        if (!snapshot.exists()) {
            thresholdRef.set({
                nhiet_max: 22,
                do_am_max: 80,
                bui_max: 50
            });
        }
    });

    thresholdRef.on('value', (snapshot) => {
        const thresh = snapshot.val();
        if (thresh) {
            currentState.nhiet_max = Number(thresh.nhiet_max) || 22;
            currentState.do_am_max = Number(thresh.do_am_max) || 80;
            currentState.bui_max = Number(thresh.bui_max) || 50;
        }

        renderThresholds();
        checkThresholdAlerts();
        handleAutoModeLogic();
    });

    sensorsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            currentState.temp = Number(data.nhiet_do) || 0;
            currentState.hum = Number(data.do_am) || 0;
            currentState.dust = Number(data.bui_min) || 0;
        }

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

        currentState.power_main = Number(controls.power_main) === 1 ? 1 : 0;
        currentState.mode_auto = Number(controls.mode_auto) === 1 ? 1 : 0;
        currentState.ac = Number(controls.ac) === 1 ? 1 : 0;
        currentState.fan = Number(controls.fan) === 1 ? 1 : 0;
        currentState.light = Number(controls.light) === 1 ? 1 : 0;
        currentState.purifier = Number(controls.purifier) === 1 ? 1 : 0;

        renderControls();
        updateUIState();
    });
}

// =============================
// 8. SLIDER UPDATE
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
// 9. SELECT ROOM
// =============================
document.getElementById('select-floor').addEventListener('change', (e) => {
    currentFloor = e.target.value;
    loadRoomData();
});

document.getElementById('select-room').addEventListener('change', (e) => {
    currentRoom = e.target.value;
    loadRoomData();
});

// =============================
// 10. BUTTON EVENTS
// =============================
btnPower.addEventListener('change', (e) => {
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
    const state = e.target.checked ? 1 : 0;
    controlsRef.update({ mode_auto: state });

    addTerminalLog(state === 1 ? 'Đã chuyển sang chế độ TỰ ĐỘNG.' : 'Đã chuyển sang chế độ THỦ CÔNG.', 'info');

    if (state === 1) {
        handleAutoModeLogic();
    }
});

btnAc.addEventListener('change', (e) => {
    controlsRef.update({ ac: e.target.checked ? 1 : 0 });
    addTerminalLog(`Máy lạnh ${e.target.checked ? 'đã BẬT' : 'đã TẮT'}.`, 'info');
});

btnFan.addEventListener('change', (e) => {
    controlsRef.update({ fan: e.target.checked ? 1 : 0 });
    addTerminalLog(`Quạt máy ${e.target.checked ? 'đã BẬT' : 'đã TẮT'}.`, 'info');
});

btnLight.addEventListener('change', (e) => {
    controlsRef.update({ light: e.target.checked ? 1 : 0 });
    addTerminalLog(`Đèn phòng ${e.target.checked ? 'đã BẬT' : 'đã TẮT'}.`, 'info');
});

btnPurifier.addEventListener('change', (e) => {
    controlsRef.update({ purifier: e.target.checked ? 1 : 0 });
    addTerminalLog(`Máy lọc bụi ${e.target.checked ? 'đã BẬT' : 'đã TẮT'}.`, 'info');
});

// =============================
// 11. RENDER CONTROLS
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
// 12. UI STATE
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
// 13. AUTO LOGIC
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
// 14. CHART
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
// 15. INIT
// =============================
renderSensors();
renderSensorSliders();
renderThresholds();
updateChart();
loadRoomData();