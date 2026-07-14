document.addEventListener("DOMContentLoaded", () => {
    
    // UI Elements Cache
    const authSection = document.getElementById("authSection");
    const mainDashboard = document.getElementById("mainDashboard");
    const loadingScreen = document.getElementById("loadingScreen");
    const globalThemeSwitcher = document.getElementById("globalThemeSwitcher");
    
    const loginForm = document.getElementById("loginForm");
    const usernameInput = document.getElementById("username");
    const gugusInput = document.getElementById("gugusName");
    const nameError = document.getElementById("nameError");
    
    const welcomeTitle = document.getElementById("welcomeTitle");
    const currentDateEl = document.getElementById("currentDate");
    const currentTimeEl = document.getElementById("currentTime");
    const attendanceStatusEl = document.getElementById("attendanceStatus");
    const progressTextEl = document.getElementById("attendanceProgressText");
    const progressBarFill = document.getElementById("progressBarFill");
    
    const attendanceForm = document.getElementById("attendanceForm");
    const dayRows = document.querySelectorAll(".day-row");
    const historyTableBody = document.getElementById("historyTableBody");
    const logoutBtn = document.getElementById("logoutBtn");
    
    const statHadirCount = document.getElementById("statHadirCount");
    const statAbsenCount = document.getElementById("statAbsenCount");
    const chartCenterText = document.getElementById("chartCenterText");
    const canvas = document.getElementById("statsCanvas");
    
    const successModal = document.getElementById("successModal");
    const closeModalBtn = document.getElementById("closeModalBtn");

    // ==========================================
    // SEBAGAI DEVELOPER: PASTE LINK URL KAMU DI SINI!
    // ==========================================
    const GOOGLE_SCRIPT_URL = "ISI_DENGAN_URL_WEB_APP_KAMU";

    // Local Storage Data Engine
    let currentUser = JSON.parse(localStorage.getItem("rawah_user")) || null;
    let recordsData = JSON.parse(localStorage.getItem("rawah_records")) || [];

    function init() {
        setupRealTimeClock();
        setupThemeHandler();
        setupRippleButtons();
        setupRowStatusHighlight();

        if (currentUser) {
            showDashboardView(false);
        } else {
            showAuthView();
        }
    }

    function showAuthView() {
        authSection.classList.remove("hidden");
        mainDashboard.classList.add("hidden");
        globalThemeSwitcher.classList.add("hidden");
    }

    function showDashboardView(withLoading = true) {
        if (withLoading) {
            loadingScreen.classList.remove("hidden");
            setTimeout(() => {
                loadingScreen.classList.add("hidden");
                renderDashboardContent();
            }, 1200);
        } else {
            renderDashboardContent();
        }
    }

    function renderDashboardContent() {
        authSection.classList.add("hidden");
        mainDashboard.classList.remove("hidden");
        globalThemeSwitcher.classList.remove("hidden");
        
        welcomeTitle.innerText = "Welcome, " + (currentUser ? currentUser.name : "User") + " 👋";
        updateAttendanceOverviewCard();
        renderHistoryTable();
        renderStatisticsChart();
        preloadTodayChoices();
        checkTimeLockSystem(); 
    }

    // SISTEM KONTROL WAKTU: SABTU & SENIN BEBAS INPUT, SELASA-KAMIS KETAT JAM 07:00
    function checkTimeLockSystem() {
        const now = new Date();
        const currentHour = now.getHours();
        
        const daysArray = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const todayName = daysArray[now.getDay()];
        const tglString = now.toLocaleDateString('id-ID');

        dayRows.forEach(row => {
            const rowDay = row.getAttribute("data-day");
            const inputs = row.querySelectorAll("input[type='radio']");
            
            // Bersihkan semua tulisan penanda lama agar tidak menumpuk
            const oldNotice = row.querySelector('.lock-notice');
            if(oldNotice) oldNotice.remove();

            // 1. JIKA BARIS ADALAH HARI SABTU ATAU SENIN -> BEBAS TOTAL
            if (rowDay === "Sabtu" || rowDay === "Senin") {
                unlockRowRow(row, inputs);
                
                // Beri tanda manis di bawah nama hari kalau hari ini jadwalnya bebas
                if (rowDay === todayName) {
                    const notice = document.createElement('span');
                    notice.className = 'lock-notice';
                    notice.style.cssText = "color: #3b82f6; font-size: 11px; font-weight: 600; display: block; margin-top: 4px;";
                    notice.innerHTML = "<i class='fas fa-unlock'></i> Hari Ini (Bebas)";
                    
                    const dayNameEl = row.querySelector('.day-name');
                    if(dayNameEl) dayNameEl.appendChild(notice);
                }
            } 
            // 2. JIKA BARIS ADALAH HARI SELASA, RABU, ATAU KAMIS -> SISTEM KETAT
            else {
                if (rowDay === todayName) {
                    const isAlreadySubmittedToday = recordsData.some(r => 
                        r.name === currentUser.name && r.hari === rowDay && r.tanggal === tglString
                    );

                    if (currentHour >= 7) {
                        if (isAlreadySubmittedToday) {
                            lockRowRow(row, inputs, "<i class='fas fa-check-double'></i> Sudah Diisi Hari Ini", "#22c55e", true);
                        } else {
                            unlockRowRow(row, inputs);
                        }
                    } else {
                        lockRowRow(row, inputs, "<i class='fas fa-lock'></i> Buka Jam 07:00", "#ef4444", false);
                    }
                } else {
                    lockRowRow(row, inputs, "<i class='fas fa-lock'></i> Terkunci", "#ef4444", false, true);
                }
            }
        });

        // Kontrol Aktivasi Tombol Simpan Akhir
        const submitBtn = document.querySelector(".style-submit-btn");
        const anyOpen = Array.from(dayRows).some(row => {
            const inputs = row.querySelectorAll("input[type='radio']");
            return inputs.length > 0 && !inputs[0].disabled;
        });

        if (submitBtn) {
            if (!anyOpen) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = "0.5";
                submitBtn.innerHTML = "<i class='fas fa-ban'></i> Absensi Belum Dibuka";
            } else {
                submitBtn.disabled = false;
                submitBtn.style.opacity = "1";
                submitBtn.innerHTML = "<i class='fas fa-save'></i> Simpan Absensi";
            }
        }
    }

    // Fungsi Kunci Baris (Diperbaiki agar Teks Notifikasi Muncul di Bawah Nama Hari)
    function lockRowRow(row, inputs, message, color, isDoneToday, clearCheck = false) {
        row.style.opacity = isDoneToday ? "0.7" : "0.4";
        inputs.forEach(input => {
            input.disabled = true;
            if(clearCheck) input.checked = false;
        });
        if(clearCheck) row.classList.remove("selected-hadir", "selected-absen");
        
        const notice = document.createElement('span');
        notice.className = 'lock-notice';
        notice.style.cssText = `color: ${color}; font-size: 11px; font-weight: 600; display: block; margin-top: 4px;`;
        notice.innerHTML = message;
        
        const dayNameEl = row.querySelector('.day-name');
        if(dayNameEl) dayNameEl.appendChild(notice);
    }

    function unlockRowRow(row, inputs) {
        row.style.opacity = "1";
        row.style.pointerEvents = "auto";
        inputs.forEach(input => input.disabled = false);
    }

    if(loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const inputName = usernameInput.value.trim();
            const inputGugus = gugusInput.value.trim();
            if (!inputName) {
                nameError.style.display = "block";
                return;
            }
            nameError.style.display = "none";
            currentUser = { name: inputName, gugus: inputGugus };
            localStorage.setItem("rawah_user", JSON.stringify(currentUser));
            showDashboardView(true);
        });
    }

    if(logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("rawah_user");
            currentUser = null;
            if(attendanceForm) attendanceForm.reset();
            dayRows.forEach(row => {
                row.className = "day-row glass-card";
                const notice = row.querySelector('.lock-notice');
                if(notice) notice.remove();
            });
            showAuthView();
        });
    }

    function setupRealTimeClock() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        function updateClock() {
            const now = new Date();
            if(currentDateEl) currentDateEl.innerText = now.toLocaleDateString('id-ID', options);
            if(currentTimeEl) currentTimeEl.innerText = now.toLocaleTimeString('id-ID');
            if (currentUser && mainDashboard.classList.contains("hidden") === false) {
                checkTimeLockSystem();
            }
        }
        setInterval(updateClock, 1000);
        updateClock();
    }

    function setupThemeHandler() {
        const cachedTheme = localStorage.getItem("rawah_theme") || "ocean";
        document.documentElement.setAttribute("data-theme", cachedTheme);
        setActiveThemeButton(cachedTheme);

        document.querySelectorAll(".theme-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const selectedTheme = btn.getAttribute("data-theme");
                document.documentElement.setAttribute("data-theme", selectedTheme);
                localStorage.setItem("rawah_theme", selectedTheme);
                setActiveThemeButton(selectedTheme);
                renderStatisticsChart();
            });
        });
    }

    function setActiveThemeButton(theme) {
        document.querySelectorAll(".theme-btn").forEach(btn => {
            if (btn.getAttribute("data-theme") === theme) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    }

    function setupRowStatusHighlight() {
        dayRows.forEach(row => {
            const inputs = row.querySelectorAll("input[type='radio']");
            inputs.forEach(input => {
                input.addEventListener("change", () => {
                    if (input.checked && !input.disabled) {
                        row.classList.remove("selected-hadir", "selected-absen");
                        row.classList.add(input.value === "Hadir" ? "selected-hadir" : "selected-absen");
                    }
                });
            });
        });
    }

    function preloadTodayChoices() {
        if(!currentUser) return;
        const userRecords = recordsData.filter(r => r.name === currentUser.name);
        dayRows.forEach(row => {
            const day = row.getAttribute("data-day");
            const dayLog = userRecords.find(r => r.hari === day);
            if(dayLog) {
                const radio = row.querySelector(`input[value="${dayLog.status}"]`);
                if(radio) {
                    radio.checked = true;
                    row.classList.add(dayLog.status === "Hadir" ? "selected-hadir" : "selected-absen");
                }
            }
        });
    }

    if(attendanceForm) {
        attendanceForm.addEventListener("submit", (e) => {
            e.preventDefault();
            
            const sabtuOpt = document.querySelector("input[name='day_Sabtu']:checked");
            const seninOpt = document.querySelector("input[name='day_Senin']:checked");
            const selasaOpt = document.querySelector("input[name='day_Selasa']:checked");
            const rabuOpt = document.querySelector("input[name='day_Rabu']:checked");
            const kamisOpt = document.querySelector("input[name='day_Kamis']:checked");

            const activeChoice = sabtuOpt || seninOpt || selasaOpt || rabuOpt || kamisOpt;

            if (!activeChoice) {
                alert("Silakan pilih status kehadiran hari ini!");
                return;
            }

            if(loadingScreen) loadingScreen.classList.remove("hidden");
            
            const now = new Date();
            const tglString = now.toLocaleDateString('id-ID');
            const jamString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

            const options = [
                { day: 'Sabtu', opt: sabtuOpt },
                { day: 'Senin', opt: seninOpt },
                { day: 'Selasa', opt: selasaOpt },
                { day: 'Rabu', opt: rabuOpt },
                { day: 'Kamis', opt: kamisOpt }
            ];

            let activeItem = options.find(item => item.opt && !item.opt.disabled);

            if(activeItem) {
                const payloadData = {
                    nama: currentUser.name,
                    gugus: currentUser.gugus,
                    hari: activeItem.day,
                    status: activeItem.opt.value,
                    tanggal: tglString,
                    jam: jamString + " WIB"
                };

                fetch(GOOGLE_SCRIPT_URL, {
                    method: "POST",
                    mode: "no-cors",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payloadData)
                })
                .then(() => {
                    if(loadingScreen) loadingScreen.classList.add("hidden");
                    
                    const logObj = {
                        name: currentUser.name,
                        gugus: currentUser.gugus,
                        hari: activeItem.day,
                        status: activeItem.opt.value,
                        tanggal: tglString,
                        jam: jamString
                    };

                    if (activeItem.day === "Sabtu" || activeItem.day === "Senin") {
                        recordsData.unshift(logObj);
                    } else {
                        const existIndex = recordsData.findIndex(r => r.name === currentUser.name && r.hari === activeItem.day && r.tanggal === tglString);
                        if(existIndex === -1) {
                            recordsData.unshift(logObj);
                        }
                    }

                    localStorage.setItem("rawah_records", JSON.stringify(recordsData));

                    updateAttendanceOverviewCard();
                    renderHistoryTable();
                    renderStatisticsChart();
                    checkTimeLockSystem(); 

                    if(successModal) successModal.classList.remove("hidden");
                })
                .catch(err => {
                    if(loadingScreen) loadingScreen.classList.add("hidden");
                    alert("Gagal mengirim ke database online: " + err);
                });
            }
        });
    }

    if(closeModalBtn) {
        closeModalBtn.addEventListener("click", () => {
            if(successModal) successModal.classList.add("hidden");
        });
    }

    function updateAttendanceOverviewCard() {
        if(!currentUser) return;
        const userLogs = recordsData.filter(r => r.name === currentUser.name);
        if (attendanceStatusEl) {
            attendanceStatusEl.innerText = userLogs.length > 0 ? "Sudah Mengisi" : "Belum Mengisi";
            attendanceStatusEl.style.color = userLogs.length > 0 ? "#22c55e" : "var(--text-muted)";
        }
        const totalHadir = userLogs.filter(r => r.status === "Hadir").length;
        const percentage = userLogs.length > 0 ? Math.round((totalHadir / 5) * 100) : 0;
        if(progressTextEl) progressTextEl.innerText = percentage + "%";
        if(progressBarFill) progressBarFill.style.width = percentage + "%";
    }

    function renderHistoryTable() {
        if(!historyTableBody) return;
        if (recordsData.length === 0) {
            historyTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Belum ada riwayat absensi.</td></tr>`;
            return;
        }
        historyTableBody.innerHTML = recordsData.map(log => {
            return `
                <tr class="fade-in">
                    <td><strong>${escapeHtml(log.name)}</strong></td>
                    <td>${escapeHtml(log.gugus)}</td>
                    <td>${log.hari}</td>
                    <td><span class="badge ${log.status === "Hadir" ? "badge-hadir" : "badge-absen"}"><i class="fas ${log.status === "Hadir" ? "fa-circle-check" : "fa-circle-xmark"}"></i> ${log.status}</span></td>
                    <td>${log.tanggal}</td>
                    <td>${log.jam} WIB</td>
                </tr>
            `;
        }).join('');
    }

    function renderStatisticsChart() {
        if(!canvas || !chartCenterText) return;
        const userLogs = recordsData.filter(r => r.name === (currentUser ? currentUser.name : "Aokira"));
        const hadirCount = userLogs.filter(r => r.status === "Hadir").length;
        const absenCount = userLogs.filter(r => r.status === "Tidak Hadir").length;
        const total = hadirCount + absenCount;

        if(statHadirCount) statHadirCount.innerText = hadirCount;
        if(statAbsenCount) statAbsenCount.innerText = absenCount;

        const percentage = total > 0 ? Math.round((hadirCount / total) * 100) : 0;
        chartCenterText.innerText = percentage + "%";

        const activeTheme = document.documentElement.getAttribute("data-theme");
        chartCenterText.style.color = (activeTheme === "sky") ? "#0c4a6e" : "#f8fafc";

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 70;
        const thickness = 14;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = (activeTheme === "sky") ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = thickness;
        ctx.stroke();

        if (total === 0) return;

        const hadirAngle = (hadirCount / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, (-Math.PI / 2) + hadirAngle);
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = thickness;
        ctx.lineCap = "round";
        ctx.stroke();

        if (absenCount > 0) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, (-Math.PI / 2) + hadirAngle, (-Math.PI / 2) + (2 * Math.PI));
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = thickness;
            ctx.lineCap = "round";
            ctx.stroke();
        }
    }

    function setupRippleButtons() {
        document.body.addEventListener("click", (e) => {
            const btn = e.target.closest(".ripple-btn");
            if (!btn) return;
            const circle = document.createElement("span");
            const diameter = Math.max(btn.clientWidth, btn.clientHeight);
            const radius = diameter / 2;
            const rect = btn.getBoundingClientRect();
            circle.style.width = circle.style.height = diameter + "px";
            circle.style.left = (e.clientX - rect.left - radius) + "px";
            circle.style.top = (e.clientY - rect.top - radius) + "px";
            circle.classList.add("ripple-effect");
            const existingRipple = btn.querySelector(".ripple-effect");
            if (existingRipple) existingRipple.remove();
            btn.appendChild(circle);
        });
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    init();
});

